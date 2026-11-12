/**
 * TIEMPO REAL DE PAGOS YAPE/PLIN (Socket.IO, namespace /live)
 *
 * El backend emite a la sala de administradores justo después de guardar:
 *   payment.created        pago reconocido
 *   notification.unparsed  notificación que el parser no entendió
 *   device.status          latido del teléfono (última conexión)
 *
 * Seguridad:
 * - El access token va en handshake.auth.token (nunca en la query) y se valida
 *   con el mismo middleware que la API REST: firma, usuario activo y
 *   token_version. Solo entra el cargo Administrador.
 * - Si el navegador manda Origin, debe estar en ALLOWED_ORIGINS (evita
 *   Cross-Site WebSocket Hijacking). Los clientes no pueden emitir nada.
 * - La conexión se corta cuando vence el token; el cliente reconecta con uno
 *   nuevo y vuelve a pedir los datos por REST.
 *
 * Si el proxy no deja pasar WebSocket, Socket.IO usa HTTP long-polling solo.
 * Solo corre en el proceso de la API: en el worker, emitir no hace nada.
 */
const { Server } = require("socket.io");
const authenticate = require("../middleware/auth.middleware");
const { allowedOrigins } = require("../../config/origenes");
const { verificarAccessToken } = require("../../../application/services/sesion.service");

const SALA_ADMINS = "admins";
let live = null;

/** Valida el token del handshake; devuelve el payload si es un Administrador vigente. */
function autenticarSocket(socket) {
  return new Promise((resolve) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || token.length > 2048) return resolve(null);
    let payload;
    try {
      payload = verificarAccessToken(token);
    } catch {
      return resolve(null);
    }
    const req = { headers: { authorization: `Bearer ${token}` } };
    authenticate(req, null, (err) => {
      if (err || req.user?.cargo !== "Administrador") return resolve(null);
      resolve(payload);
    });
  });
}

/** Monta Socket.IO sobre el servidor HTTP de la API (main.js). */
function iniciar(httpServer) {
  const permitidos = new Set(allowedOrigins);
  const io = new Server(httpServer, {
    path: "/socket.io",
    serveClient: false,
    maxHttpBufferSize: 10_000,
    cors: { origin: [...permitidos], credentials: false },
    allowRequest: (req, cb) => {
      const origin = req.headers.origin;
      cb(null, origin === undefined || permitidos.has(origin));
    },
  });

  live = io.of("/live");
  live.use((socket, next) => {
    autenticarSocket(socket)
      .then((payload) => {
        if (!payload) return next(new Error("unauthorized"));
        const msRestantes = payload.exp * 1000 - Date.now();
        const timer = setTimeout(() => socket.disconnect(true), Math.max(msRestantes, 0));
        socket.on("disconnect", () => clearTimeout(timer));
        next();
      })
      .catch(() => next(new Error("unauthorized")));
  });
  live.on("connection", (socket) => {
    socket.join(SALA_ADMINS);
    // Los clientes no pueden emitir nada: se ignora cualquier evento entrante.
    socket.onAny(() => undefined);
  });
  return io;
}

const emitir = (evento, datos) => live?.to(SALA_ADMINS).emit(evento, datos);

module.exports = {
  iniciar,
  emitirPago: (datos) => emitir("payment.created", datos),
  emitirNoReconocida: (datos) => emitir("notification.unparsed", datos),
  emitirEstadoDispositivo: (datos) => emitir("device.status", datos),
};
