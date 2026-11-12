const { UnauthorizedError } = require("../../utils/errors");
const { buscarPorClave } = require("../../../application/services/notifier/dispositivos.service");

/**
 * Autentica al teléfono de Pagos Yape/Plin por la cabecera X-Device-Key.
 *
 * El dispositivo se DERIVA de la clave (se busca por su SHA-256): nunca se
 * confía en cabeceras de identidad enviadas por el teléfono. La clave tiene
 * 256 bits de entropía, así que buscarla por hash en un índice único no
 * filtra información útil. Estas rutas están en la lista blanca de
 * authGlobal porque no usan el JWT de los usuarios.
 *
 * Avisa en el log si en 10 minutos se rechazan muchas claves (posible clave
 * filtrada o ataque).
 */
const UMBRAL_ALERTA = Number(process.env.NOTIFIER_AUTH_FAILURE_ALERT_PER_10MIN || 20);
let rechazos = [];

function rechazar(req, next) {
  const ahora = Date.now();
  rechazos = rechazos.filter((t) => ahora - t < 10 * 60 * 1000);
  rechazos.push(ahora);
  if (rechazos.length === UMBRAL_ALERTA) {
    console.warn(`[Pagos] ALERTA: ${UMBRAL_ALERTA} claves de dispositivo rechazadas en 10 min (última IP ${req.ip})`);
  }
  return next(new UnauthorizedError("No autenticado"));
}

async function autenticarDispositivo(req, _res, next) {
  const clave = req.headers["x-device-key"];
  if (typeof clave !== "string" || clave.length < 32 || clave.length > 128) return rechazar(req, next);
  try {
    const device = await buscarPorClave(clave);
    if (!device) return rechazar(req, next);
    req.device = { id: device.id, name: device.name };
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = autenticarDispositivo;
