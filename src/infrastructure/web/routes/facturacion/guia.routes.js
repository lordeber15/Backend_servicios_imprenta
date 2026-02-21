/**
 * @swagger
 * tags:
 *   name: Guías
 *   description: Gestión de guías de remisión electrónicas
 */

"use strict";
const { Router } = require("express");
const authenticate = require("../../middleware/auth.middleware");
const {
  createGuia,
  createDetalleGuia,
  emitirGuia,
  consultarEstadoGuia,
  descargarPdfGuia,
  descargarXmlGuia,
} = require("../../controllers/facturacion/guia.controller");

const router = Router();

/**
 * @swagger
 * /guia:
 *   post:
 *     summary: Crear la cabecera de la Guía de Remisión
 *     tags: [Guías]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Cabecera creada
 */
router.post("/guia", authenticate, createGuia);

/**
 * @swagger
 * /guia/detalle:
 *   post:
 *     summary: Crear un detalle de la Guía de Remisión
 *     tags: [Guías]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Detalle creado
 */
router.post("/guia/detalle", authenticate, createDetalleGuia);

/**
 * @swagger
 * /guia/emitir:
 *   post:
 *     summary: Emitir una Guía de Remisión a SUNAT
 *     tags: [Guías]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Guía emitida
 */
router.post("/guia/emitir", authenticate, emitirGuia);

/**
 * @swagger
 * /guia/{id}/estado:
 *   get:
 *     summary: Consultar estado de una guía
 *     tags: [Guías]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Estado obtenido
 */
router.get("/guia/:id/estado", authenticate, consultarEstadoGuia);

/**
 * @swagger
 * /guia/{id}/pdf:
 *   get:
 *     summary: Descargar PDF de la guía
 *     tags: [Guías]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Archivo PDF
 */
router.get("/guia/:id/pdf", authenticate, descargarPdfGuia);

/**
 * @swagger
 * /guia/{id}/xml:
 *   get:
 *     summary: Descargar XML de la guía
 *     tags: [Guías]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Archivo XML
 */
router.get("/guia/:id/xml", authenticate, descargarXmlGuia);

module.exports = router;
