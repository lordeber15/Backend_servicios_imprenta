/**
 * SESIÓN: login, refresh, logout y cambio de la propia contraseña.
 *
 * Respuesta de login y refresh:
 *   { access_token, expires_in, usuario: { id, usuario, cargo, image_url, formatos } }
 * más la cookie httpOnly del refresh token (ver web/cookies.js). El access
 * token NO debe persistirse en el navegador: el frontend lo guarda en memoria
 * y al recargar la página lo recupera con POST /auth/refresh.
 */
const jwt = require("jsonwebtoken");
const SequelizeUserRepository = require("../../database/repositories/SequelizeUserRepository");
const LoginUserUseCase = require("../../../application/use_cases/auth/LoginUser");
const { LoginError } = require("../../../application/use_cases/auth/LoginUser");
const sesion = require("../../../application/services/sesion.service");
const { registrar } = require("../../../application/services/auditoria.service");
const { verificar, hashear } = require("../../../application/services/password.service");
const { loginSchema, cambiarPasswordSchema } = require("../../../application/validation/usuario.schema");
const { mensajeError } = require("../../../application/validation/emision.schema");
const { Login } = require("../../database/models/login");
const sequelize = require("../../database/database");
const { ponerRefresh, borrarRefresh, leerRefresh } = require("../cookies");
const { origenPermitido } = require("../../config/origenes");
const { ValidationError, UnauthorizedError, ForbiddenError } = require("../../utils/errors");

const userRepository = new SequelizeUserRepository();

const meta = (req) => ({ ip: req.ip, userAgent: req.get("user-agent") });

/** Segundos de vida del access token (para que el frontend pueda anticiparse). */
const expiraEn = (token) => {
  const { exp } = jwt.decode(token);
  return Math.max(0, exp - Math.floor(Date.now() / 1000));
};

const responderSesion = (res, { accessToken, refresh, usuario }) => {
  ponerRefresh(res, refresh);
  res.set("Cache-Control", "no-store");
  return res.json({ access_token: accessToken, expires_in: expiraEn(accessToken), usuario });
};

/**
 * Defensa CSRF de las rutas que actúan con la cookie: además de SameSite=Strict,
 * el Origin tiene que ser uno de ALLOWED_ORIGINS. Un navegador siempre lo envía
 * en un POST con fetch/XHR; si falta, no es nuestra SPA.
 */
const exigirOrigen = (req, _res, next) => {
  if (origenPermitido(req.get("origin"))) return next();
  return next(new ForbiddenError("Origen no permitido"));
};

/** POST /auth/login */
const login = async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return next(new ValidationError("Usuario y contraseña son requeridos"));

  try {
    const user = await new LoginUserUseCase(userRepository).execute(parsed.data);
    const datos = await sesion.iniciarSesion(user, meta(req));
    registrar(req, "login_ok", { usuario: user, entidad: "logins", entidad_id: user.id });
    return responderSesion(res, datos);
  } catch (err) {
    if (err instanceof LoginError) {
      registrar(req, "login_fallido", {
        entidad: "logins",
        despues: { usuario: parsed.data.usuario.slice(0, 100), motivo: err.motivo },
      });
      return res.status(err.statusCode).json({ message: err.message });
    }
    return next(err);
  }
};

/** POST /auth/refresh — rota el refresh token y entrega un access token nuevo. */
const refresh = async (req, res, next) => {
  try {
    const datos = await sesion.rotarSesion(leerRefresh(req), meta(req));
    return responderSesion(res, datos);
  } catch (err) {
    // Solo una sesión inválida borra la cookie; un fallo transitorio (BD caída)
    // no debe cerrar la sesión del usuario.
    if (!(err instanceof UnauthorizedError)) return next(err);
    borrarRefresh(res);
    if (err.reutilizado) {
      console.warn(`[Sesion] refresh reutilizado: usuario ${err.usuarioId}, familia ${err.familia} revocada (${err.revocados} activos)`);
      registrar(req, "refresh_reutilizado", {
        usuario: { id: err.usuarioId },
        entidad: "RefreshTokens",
        entidad_id: err.familia,
        despues: { sesiones_revocadas: err.revocados },
      });
    }
    return next(err);
  }
};

/** POST /auth/logout — revoca el refresh y borra la cookie. Idempotente. */
const logout = async (req, res, next) => {
  try {
    const usuarioId = await sesion.cerrarSesion(leerRefresh(req));
    borrarRefresh(res);
    if (usuarioId) registrar(req, "logout", { usuario: { id: usuarioId }, entidad: "logins", entidad_id: usuarioId });
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /auth/password — el usuario cambia SU contraseña (exige la actual).
 * Cierra todas sus sesiones, incluida esta: debe volver a iniciar sesión.
 */
const cambiarPassword = async (req, res, next) => {
  try {
    const parsed = cambiarPasswordSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(mensajeError(parsed.error));
    const { password_actual, password_nueva } = parsed.data;

    await sequelize.transaction(async (transaction) => {
      const user = await Login.findByPk(req.user.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!(await verificar(password_actual, user?.password))) {
        throw new ValidationError("La contraseña actual no es correcta");
      }
      if (password_nueva.toLowerCase().includes(user.usuario.toLowerCase())) {
        throw new ValidationError("La contraseña no puede contener el nombre de usuario");
      }
      await user.update({ password: await hashear(password_nueva) }, { transaction });
      await sesion.revocarSesionesUsuario(user.id, "password_cambiada", transaction);
      await registrar(req, "password_cambiada", { entidad: "logins", entidad_id: user.id, transaction });
    });

    borrarRefresh(res);
    return res.json({ message: "Contraseña actualizada. Inicie sesión nuevamente." });
  } catch (err) {
    return next(err);
  }
};

module.exports = { login, refresh, logout, cambiarPassword, exigirOrigen };
