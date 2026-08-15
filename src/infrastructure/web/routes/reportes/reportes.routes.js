/**
 * @swagger
 * tags:
 *   name: Reportes
 *   description: Reportes administrativos de documentos electrónicos
 */

"use strict";
const { Router } = require("express");
const authenticate = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/authorize.middleware");
const { listarDocumentos } = require("../../controllers/reportes/reportes.controller");

const router = Router();

/**
 * @swagger
 * /reportes/documentos:
 *   get:
 *     summary: Reporte de documentos electrónicos aceptados por SUNAT
 *     description: >
 *       Lista facturas, boletas, notas de crédito/débito y guías de remisión
 *       aceptadas por SUNAT dentro de un rango de fechas. Los comprobantes
 *       anulados (comunicación de baja o resumen diario con condición 3) se
 *       excluyen salvo que se pida incluir_anulados=1. Solo Administrador.
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tipos
 *         description: "CSV de códigos: 01, 03, 07, 08, 09, 31. Vacío = todos"
 *         schema:
 *           type: string
 *           example: "01,03"
 *       - in: query
 *         name: desde
 *         description: Fecha inicial inclusive (por defecto, día 1 del mes en curso)
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: hasta
 *         description: Fecha final inclusive (por defecto, hoy)
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: cliente
 *         description: Búsqueda parcial por razón social o número de documento
 *         schema:
 *           type: string
 *       - in: query
 *         name: serie
 *         schema:
 *           type: string
 *       - in: query
 *         name: incluir_anulados
 *         schema:
 *           type: string
 *           enum: ["0", "1"]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Documentos del rango, ordenados por fecha descendente
 *       400:
 *         description: Parámetros inválidos (fecha, tipo o rango)
 *       403:
 *         description: Requiere cargo Administrador
 */
router.get("/reportes/documentos", authenticate, authorize("Administrador"), listarDocumentos);

module.exports = router;
