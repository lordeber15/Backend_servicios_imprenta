const QRCode = require("qrcode");
const sequelize = require("../../../infrastructure/database/database");
const { Op } = require("sequelize");
const { NotifierDevice, NotifierEnrollToken } = require("../../../infrastructure/database/models/notifier/notifier");
const { notifierConfig } = require("../../../infrastructure/config/notifier");
const { UnauthorizedError, NotFoundError } = require("../../../infrastructure/utils/errors");
const gateway = require("../../../infrastructure/web/realtime/notifier.gateway");
const { sha256Hex, tokenAleatorio } = require("./texto");

const VIGENCIA_QR_MS = 10 * 60 * 1000;

/**
 * Código QR de un solo uso para enlazar el teléfono. Solo se guarda su hash.
 * El QR lleva { v, apiUrl, enrollToken }, el formato que valida la app.
 * apiUrl: NOTIFIER_PUBLIC_API_URL o, si no está, la URL por la que el panel
 * llegó a esta API (la misma que usará el teléfono).
 */
async function crearCodigoEnlace(urlDeLaPeticion) {
  const apiUrl = notifierConfig.publicApiUrl || urlDeLaPeticion;
  const enrollToken = tokenAleatorio();
  const expiresAt = new Date(Date.now() + VIGENCIA_QR_MS);
  await NotifierEnrollToken.create({ token_hash: sha256Hex(enrollToken), expires_at: expiresAt });
  const payload = { v: 1, apiUrl, enrollToken };
  const qr = await QRCode.toDataURL(JSON.stringify(payload), { errorCorrectionLevel: "M", margin: 2, width: 320 });
  return { apiUrl: payload.apiUrl, enrollToken, expiresAt: expiresAt.toISOString(), qr };
}

/** Canjea el código por una clave nueva. La clave en claro solo existe en esta respuesta. */
async function enlazar(enrollToken, name, appVersion) {
  const tokenHash = sha256Hex(enrollToken);
  const apiKey = tokenAleatorio();
  return sequelize.transaction(async (transaction) => {
    const [reclamados] = await NotifierEnrollToken.update(
      { used_at: new Date() },
      { where: { token_hash: tokenHash, used_at: null, expires_at: { [Op.gt]: new Date() } }, transaction },
    );
    if (reclamados !== 1) throw new UnauthorizedError("Código QR inválido o expirado");

    const device = await NotifierDevice.create({
      name,
      api_key_hash: sha256Hex(apiKey),
      app_version: appVersion?.slice(0, 32) || null,
      last_seen_at: new Date(),
    }, { transaction });
    await NotifierEnrollToken.update({ device_id: device.id }, { where: { token_hash: tokenHash }, transaction });
    return { deviceId: device.id, name: device.name, apiKey };
  });
}

/** Dispositivo vigente dueño de la clave, o null. El id se DERIVA de la clave. */
function buscarPorClave(apiKey) {
  return NotifierDevice.findOne({
    where: { api_key_hash: sha256Hex(apiKey), revoked_at: null },
    attributes: ["id", "name"],
  });
}

/** Latido: actualiza la última conexión y avisa al panel. */
async function registrarLatido(deviceId, appVersion) {
  const cambios = { last_seen_at: new Date() };
  if (appVersion) cambios.app_version = String(appVersion).slice(0, 32);
  await NotifierDevice.update(cambios, { where: { id: deviceId } });
  const d = await NotifierDevice.findByPk(deviceId, { attributes: ["id", "name", "last_seen_at"] });
  if (d) gateway.emitirEstadoDispositivo({ id: d.id, name: d.name, lastSeenAt: d.last_seen_at?.toISOString() ?? null });
}

async function listar() {
  const filas = await NotifierDevice.findAll({
    order: [["created_at", "DESC"]],
    attributes: ["id", "name", "last_seen_at", "app_version", "revoked_at", "created_at"],
  });
  return filas.map((d) => ({
    id: d.id,
    name: d.name,
    lastSeenAt: d.last_seen_at?.toISOString() ?? null,
    appVersion: d.app_version,
    revokedAt: d.revoked_at?.toISOString() ?? null,
    createdAt: d.created_at.toISOString(),
  }));
}

async function revocar(id) {
  const [n] = await NotifierDevice.update({ revoked_at: new Date() }, { where: { id, revoked_at: null } });
  if (n === 0) throw new NotFoundError("Dispositivo no encontrado");
}

module.exports = { crearCodigoEnlace, enlazar, buscarPorClave, registrarLatido, listar, revocar };
