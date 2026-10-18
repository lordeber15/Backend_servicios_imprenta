const express = require("express");
const sequelize = require("../../database/database");
const redis = require("../../config/redis");
const { estadoWorker, conTimeout } = require("../../../application/services/pendientesSunat.service");
const { estadoCertificado } = require("../../../application/services/certificado.service");
const router = express.Router();

/**
 * Rutas públicas (sin token): solo dicen si el servicio funciona, sin datos
 * internos (rutas, versiones, memoria ni configuración).
 */

/**
 * GET /health — liveness: el proceso responde.
 */
router.get("/", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * GET /health/ready — readiness: BD y Redis responden. Es el healthcheck del
 * contenedor (503 si alguno falla). El worker y el certificado se informan
 * pero no tumban la API: sin ellos se puede seguir vendiendo, aunque los
 * envíos esperen.
 */
router.get("/ready", async (_req, res) => {
  const [bd, cola] = await Promise.all([
    conTimeout(sequelize.query("SELECT 1"), 2000).then(() => "ok", () => "error"),
    conTimeout(redis.ping(), 2000).then(() => "ok", () => "error"),
  ]);
  const { worker } = await estadoWorker();
  const cert = estadoCertificado();
  const listo = bd === "ok" && cola === "ok";
  res.set("Cache-Control", "no-store");
  res.status(listo ? 200 : 503).json({
    status: listo ? "ok" : "error",
    checks: { base_de_datos: bd, redis: cola, worker: worker.activo ? "ok" : "sin_latido", certificado: cert.estado },
  });
});

/**
 * GET /health/cors — diagnóstico de CORS. Solo fuera de producción: muestra
 * la lista de orígenes permitidos.
 */
if (process.env.NODE_ENV !== "production") {
  router.get("/cors", (req, res) => {
    const { allowedOrigins } = require("../../config/origenes");
    res.json({ allowedOrigins, requestOrigin: req.get("origin") || null, originAllowed: allowedOrigins.includes(req.get("origin")) });
  });
}

module.exports = router;
