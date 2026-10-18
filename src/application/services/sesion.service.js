"use strict";
/**
 * SESIONES: access token corto + refresh token rotativo
 *
 * - Access token (JWT HS256, 15 min por defecto): viaja en el header
 *   Authorization y el frontend lo guarda SOLO en memoria. Lleva token_version
 *   (tv); authenticate lo compara con la BD, así que cambiar contraseña, cargo
 *   o desactivar al usuario lo invalida al instante (con caché de 30 s).
 * - Refresh token (32 bytes aleatorios): viaja en una cookie httpOnly,
 *   Secure, SameSite=Strict, Path=/auth. En la BD solo queda su SHA-256.
 *   Cada uso lo ROTA (se revoca y se emite otro de la misma familia). Si llega
 *   uno ya rotado, alguien lo copió: se revoca la familia completa y ambos
 *   (el legítimo y el atacante) tienen que volver a iniciar sesión.
 * - Una sesión dura 7 días sin uso y como máximo 30 días desde el login,
 *   aunque se use a diario (sesion_inicio no cambia al rotar).
 */
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const sequelize = require("../../infrastructure/database/database");
const RefreshToken = require("../../infrastructure/database/models/auth/refreshToken");
const { Login } = require("../../infrastructure/database/models/login");
const { UnauthorizedError } = require("../../infrastructure/utils/errors");

const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const DIA_MS = 24 * 60 * 60 * 1000;
const REFRESH_MS = Number(process.env.REFRESH_TOKEN_DIAS || 7) * DIA_MS;
const SESION_MAX_MS = Number(process.env.SESION_MAX_DIAS || 30) * DIA_MS;
const ALGORITMO = "HS256";

const sha256 = (t) => crypto.createHash("sha256").update(t).digest("hex");
const recortar = (s, n) => (s ? String(s).slice(0, n) : null);

/** Datos públicos del usuario que recibe el frontend (nunca el hash ni la versión). */
async function perfil(usuarioId) {
  const u = await Login.findByPk(usuarioId, {
    include: [{ association: "formatos", attributes: ["key"] }],
  });
  return {
    id: u.id,
    usuario: u.usuario,
    cargo: u.cargo,
    image_url: u.image_url,
    formatos: (u.formatos || []).map((f) => f.key),
  };
}

function emitirAccessToken(user) {
  return jwt.sign(
    { id: user.id, usuario: user.usuario, cargo: user.cargo, tv: user.token_version },
    process.env.JWT_SECRET,
    { algorithm: ALGORITMO, expiresIn: ACCESS_TTL, jwtid: crypto.randomUUID() }
  );
}

/** @returns {object} payload del JWT. Lanza si la firma, el algoritmo o la expiración fallan. */
function verificarAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: [ALGORITMO] });
}

/** Crea un refresh token; devuelve el valor en claro (solo para la cookie). */
async function crearRefresh(usuarioId, { familyId, sesionInicio, meta = {} }, transaction) {
  const token = crypto.randomBytes(32).toString("base64url");
  const inicio = sesionInicio || new Date();
  const expira = new Date(Math.min(Date.now() + REFRESH_MS, inicio.getTime() + SESION_MAX_MS));
  await RefreshToken.create({
    usuario_id: usuarioId,
    token_hash: sha256(token),
    family_id: familyId || crypto.randomUUID(),
    sesion_inicio: inicio,
    expires_at: expira,
    user_agent: recortar(meta.userAgent, 255),
    ip: recortar(meta.ip, 64),
  }, { transaction });
  return { token, expira };
}

/** Sesión nueva tras un login correcto. */
async function iniciarSesion(user, meta) {
  // Limpieza oportunista: los tokens vencidos hace más de 30 días no sirven ni como rastro.
  RefreshToken.destroy({ where: { expires_at: { [Op.lt]: new Date(Date.now() - 30 * DIA_MS) } } })
    .catch((e) => console.warn("[Sesion] limpieza de refresh tokens:", e.message));

  const refresh = await crearRefresh(user.id, { meta });
  return { accessToken: emitirAccessToken(user), refresh, usuario: await perfil(user.id) };
}

/**
 * Rota el refresh token.
 * @returns {Promise<{accessToken, refresh, usuario}>}
 * @throws {UnauthorizedError} token desconocido, vencido, revocado o usuario inactivo.
 *         err.reutilizado = true si era un token ya rotado (se revocó la familia).
 */
async function rotarSesion(token, meta) {
  if (!token) throw new UnauthorizedError("Sesión no iniciada");

  const resultado = await sequelize.transaction(async (transaction) => {
    const actual = await RefreshToken.findOne({
      where: { token_hash: sha256(token) },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!actual) throw new UnauthorizedError("Sesión no válida");

    if (actual.revoked_at) {
      // Revocado por logout, cambio de credenciales o una revocación anterior:
      // simplemente ya no vale.
      if (actual.revoked_motivo !== "rotado") throw new UnauthorizedError("Sesión no válida");
      // Un token ROTADO que vuelve a usarse: alguien tiene una copia de la cookie.
      const [n] = await RefreshToken.update(
        { revoked_at: new Date(), revoked_motivo: "reutilizado" },
        { where: { family_id: actual.family_id, revoked_at: null }, transaction }
      );
      return { reutilizado: true, usuarioId: actual.usuario_id, familia: actual.family_id, revocados: n };
    }
    if (actual.expires_at <= new Date()) throw new UnauthorizedError("Sesión expirada");

    const user = await Login.findByPk(actual.usuario_id, { transaction });
    if (!user || !user.activo) throw new UnauthorizedError("Sesión no válida");

    await actual.update({ revoked_at: new Date(), revoked_motivo: "rotado" }, { transaction });
    const refresh = await crearRefresh(user.id, {
      familyId: actual.family_id,
      sesionInicio: actual.sesion_inicio,
      meta,
    }, transaction);
    return { user, refresh };
  });

  if (resultado.reutilizado) {
    // La revocación ya se confirmó (commit) antes de responder 401.
    const err = new UnauthorizedError("Sesión revocada por seguridad. Inicie sesión nuevamente.");
    Object.assign(err, resultado);
    throw err;
  }
  return {
    accessToken: emitirAccessToken(resultado.user),
    refresh: resultado.refresh,
    usuario: await perfil(resultado.user.id),
  };
}

/** Logout: revoca el refresh presentado. Devuelve el usuario_id o null. */
async function cerrarSesion(token) {
  if (!token) return null;
  const actual = await RefreshToken.findOne({ where: { token_hash: sha256(token) } });
  if (!actual) return null;
  if (!actual.revoked_at) await actual.update({ revoked_at: new Date(), revoked_motivo: "logout" });
  return actual.usuario_id;
}

/**
 * Invalida TODAS las sesiones de un usuario: sube token_version (los access
 * tokens vigentes dejan de valer) y revoca sus refresh tokens.
 */
async function revocarSesionesUsuario(usuarioId, motivo, transaction) {
  await Login.increment("token_version", { by: 1, where: { id: usuarioId }, transaction });
  await RefreshToken.update(
    { revoked_at: new Date(), revoked_motivo: recortar(motivo, 30) },
    { where: { usuario_id: usuarioId, revoked_at: null }, transaction }
  );
  // La caché de authenticate se vacía al confirmar: antes del commit otra
  // petición podría volver a cachear la versión vieja.
  const { olvidarUsuario } = require("../../infrastructure/web/middleware/auth.middleware");
  olvidarUsuario(usuarioId);
  if (transaction) transaction.afterCommit(() => olvidarUsuario(usuarioId));
}

module.exports = {
  emitirAccessToken,
  verificarAccessToken,
  iniciarSesion,
  rotarSesion,
  cerrarSesion,
  revocarSesionesUsuario,
  REFRESH_MS,
};
