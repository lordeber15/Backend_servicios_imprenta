const { Router } = require("express");
const UnidadModel = require("../../../database/models/facturacion/unidad");
const soloCampos = require("../../middleware/soloCampos");
const {
  getUnidad,
  createUnidad,
  deleteUnidad,
  updateUnidad,
} = require("../../controllers/facturacion/unidad.controller");
const router = Router();

/**
 * @swagger
 * /unidad:
 *   get:
 *     summary: Listar unidades de medida (Catálogo SUNAT)
 *     tags: [Nomenclaturas]
 *     responses:
 *       200:
 *         description: Lista de unidades
 */
router.get("/unidad", getUnidad);
router.post("/unidad", soloCampos(UnidadModel), createUnidad);

/**
 * @swagger
 * /unidad/{id}:
 *   delete:
 *     summary: Eliminar una unidad
 *     tags: [Nomenclaturas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Unidad eliminada
 */
router.delete("/unidad/:id", deleteUnidad);
router.put("/unidad/:id", soloCampos(UnidadModel), updateUnidad);

module.exports = router;
