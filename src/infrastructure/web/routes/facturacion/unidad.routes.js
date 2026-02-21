const { Router } = require("express");
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
router.post("/unidad", createUnidad);

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
router.put("/unidad/:id", updateUnidad);

module.exports = router;
