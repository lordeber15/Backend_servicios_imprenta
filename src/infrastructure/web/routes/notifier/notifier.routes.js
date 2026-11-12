/**
 * @swagger
 * tags:
 *   name: Pagos Yape/Plin
 *   description: Pagos capturados por el teléfono Android (Pagos Notifier)
 */

const { Router } = require("express");
const { rateLimit } = require("express-rate-limit");
const autenticarDispositivo = require("../../middleware/dispositivo.middleware");
const c = require("../../controllers/notifier/notifier.controller");

const router = Router();

/** Express 4 no captura promesas rechazadas: se pasan al manejador global. */
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Enlazar: un código QR vale 10 min; limita adivinar códigos. */
const enlaceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Demasiados intentos de enlace. Espera 15 minutos." },
});

/** Ingesta y latido: la app sube lotes de hasta 50; 60 por minuto sobra. */
const ingestaLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Demasiadas solicitudes. Espera un momento." },
});

// ── App Android (X-Device-Key; públicas para authGlobal) ───────────────────
router.post("/api/v1/devices/enroll", enlaceLimiter, h(c.enlazar));
router.get("/api/v1/devices/me", ingestaLimiter, autenticarDispositivo, h(c.yo));
router.post("/api/v1/notifications", ingestaLimiter, autenticarDispositivo, h(c.ingerir));

// ── Panel (JWT; solo Administrador en permisos.js) ─────────────────────────
router.post("/api/v1/devices/enroll-tokens", h(c.crearCodigoEnlace));
router.get("/api/v1/devices", h(c.listarDispositivos));
router.delete("/api/v1/devices/:id", h(c.revocarDispositivo));
router.get("/api/v1/notifications/unparsed", h(c.listarNoReconocidas));
router.get("/api/v1/payments", h(c.listarPagos));
router.get("/api/v1/payments/summary", h(c.resumen));
router.get("/api/v1/payments/totals", h(c.totales));
router.get("/api/v1/payments/export.csv", h(c.exportarCsv));
router.get("/api/v1/payments/:id", h(c.detallePago));

module.exports = router;
