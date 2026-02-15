/**
 * @swagger
 * tags:
 *   name: Resumen Diario
 *   description: Envío masivo de boletas y consultas de tickets a SUNAT
 */

"use strict";
const { Router } = require("express");
const authenticate = require("../../middleware/auth.middleware");
const {
  generarResumenDiario,
  consultarTicketResumen,
} = require("../../controllers/facturacion/resumen_diario.controller");

const router = Router();

/**
 * @swagger
 * /resumen-diario:
 *   post:
 *     summary: Generar y enviar un Resumen Diario de boletas
 *     tags: [Resumen Diario]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resumen enviado exitosamente
 */
router.post("/resumen-diario", authenticate, generarResumenDiario);

/**
 * @swagger
 * /resumen-diario/{id}/consultar-ticket:
 *   get:
 *     summary: Consultar el estado de un ticket de Resumen Diario
 *     tags: [Resumen Diario]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Estado del ticket obtenido
 */
router.get("/resumen-diario/:id/consultar-ticket", authenticate, consultarTicketResumen);

module.exports = router;
