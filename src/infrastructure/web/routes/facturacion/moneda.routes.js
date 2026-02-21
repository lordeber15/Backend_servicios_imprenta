/**
 * @swagger
 * tags:
 *   name: Nomenclaturas
 *   description: Catálogos y tablas paramétricas (Monedas, Unidades, etc.)
 */

const { Router } = require("express");
const {
  getMoneda,
  createMoneda,
  deleteMoneda,
  updateMoneda,
} = require("../../controllers/facturacion/moneda.controller");
const router = Router();

/**
 * @swagger
 * /moneda:
 *   get:
 *     summary: Listar monedas configuradas
 *     tags: [Nomenclaturas]
 *     responses:
 *       200:
 *         description: Lista de monedas
 */
router.get("/moneda", getMoneda);
router.post("/moneda", createMoneda);

/**
 * @swagger
 * /moneda/{id}:
 *   delete:
 *     summary: Eliminar una moneda
 *     tags: [Nomenclaturas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Moneda eliminada
 */
router.delete("/moneda/:id", deleteMoneda);
router.put("/moneda/:id", updateMoneda);

module.exports = router;
