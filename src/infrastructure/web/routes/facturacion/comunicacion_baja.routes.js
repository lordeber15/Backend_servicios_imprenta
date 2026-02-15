/**
 * @swagger
 * tags:
 *   name: SUNAT
 *   description: Integración de facturación electrónica y servicios de SUNAT
 */

"use strict";
const { Router } = require("express");
const authenticate = require("../../middleware/auth.middleware");
const {
  crearComunicacionBaja,
  consultarTicketBaja,
} = require("../../controllers/facturacion/comunicacion_baja.controller");

const router = Router();

/**
 * @swagger
 * /comunicacion-baja:
 *   post:
 *     summary: Enviar una Comunicación de Baja (Anulación) a SUNAT
 *     tags: [SUNAT]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Comunicación de baja enviada
 */
router.post("/comunicacion-baja", authenticate, crearComunicacionBaja);

/**
 * @swagger
 * /comunicacion-baja/{id}/consultar-ticket:
 *   get:
 *     summary: Consultar ticket de una Comunicación de Baja
 *     tags: [SUNAT]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Estado del ticket obtenido
 */
router.get("/comunicacion-baja/:id/consultar-ticket", authenticate, consultarTicketBaja);

module.exports = router;
