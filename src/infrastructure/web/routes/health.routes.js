const express = require("express");
const router = express.Router();

/**
 * Endpoint de diagnóstico CORS
 * GET /health/cors
 *
 * Muestra la configuración actual de CORS para debugging
 */
router.get("/cors", (req, res) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map(o => o.trim()) || [];

  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    cors: {
      allowedOrigins,
      requestOrigin: req.get('origin') || 'No origin header',
      originAllowed: allowedOrigins.includes(req.get('origin')),
    },
    env: {
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: process.env.PORT || 3000,
    },
    headers: {
      origin: req.get('origin'),
      host: req.get('host'),
      referer: req.get('referer'),
    }
  });
});

/**
 * Endpoint de health check básico
 * GET /health
 */
router.get("/", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

module.exports = router;
