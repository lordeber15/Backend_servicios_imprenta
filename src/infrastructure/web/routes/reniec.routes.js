/**
 * @swagger
 * tags:
 *   name: RENIEC
 *   description: Consulta de identidad (DNI) vía API externa
 */

const { Router } = require("express");
const { getReniec } = require("../controllers/reniec.controller.js");
const { reniecLimiter } = require("../middleware/rateLimit.middleware");
const router = Router();

/**
 * @swagger
 * /api/reniec/{dni}:
 *   get:
 *     summary: Consultar datos de un DNI
 *     tags: [RENIEC]
 *     parameters:
 *       - in: path
 *         name: dni
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Datos de la persona obtenidos
 */
router.get("/api/reniec/:dni", reniecLimiter, getReniec);

module.exports = router;
