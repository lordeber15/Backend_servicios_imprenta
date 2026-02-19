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
  emitirComprobante,
  reenviarComprobante,
  consultarEstado,
  descargarPdf,
  descargarXml,
} = require("../../controllers/facturacion/sunat.controller");

const router = Router();

/**
 * @swagger
 * /comprobante/emitir:
 *   post:
 *     summary: Emitir un comprobante electrónico a SUNAT
 *     tags: [SUNAT]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *                 description: ID del comprobante en la base de datos
 *     responses:
 *       200:
 *         description: Comprobante aceptado por SUNAT
 *       400:
 *         description: Error en la validación o envío
 */
router.post("/comprobante/emitir", authenticate, emitirComprobante);

/**
 * @swagger
 * /comprobante/{id}/reenviar:
 *   post:
 *     summary: Reenviar un comprobante que falló
 *     tags: [SUNAT]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Reenvío exitoso
 */
router.post("/comprobante/:id/reenviar", authenticate, reenviarComprobante);

/**
 * @swagger
 * /comprobante/{id}/estado:
 *   get:
 *     summary: Consultar estado de un comprobante en SUNAT
 *     tags: [SUNAT]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Estado consultado
 */
router.get("/comprobante/:id/estado", authenticate, consultarEstado);

/**
 * @swagger
 * /comprobante/{id}/pdf:
 *   get:
 *     summary: Descargar PDF del comprobante
 *     tags: [SUNAT]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Archivo PDF
 */
router.get("/comprobante/:id/pdf", descargarPdf);

/**
 * @swagger
 * /comprobante/{id}/xml:
 *   get:
 *     summary: Descargar XML firmado del comprobante
 *     tags: [SUNAT]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Archivo XML
 */
router.get("/comprobante/:id/xml", descargarXml);

module.exports = router;
