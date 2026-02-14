const { Router } = require("express");
const {
  getTipo_afectacion,
  createTipo_afectacion,
  deleteTipo_afectacion,
  updateTipo_afectacion,
} = require("../../controllers/facturacion/tipo_afectacion.controller");
const router = Router();

/**
 * @swagger
 * /tipo_afectacion:
 *   get:
 *     summary: Listar tipos de afectación al IGV (Catálogo 07 SUNAT)
 *     tags: [Nomenclaturas]
 *     responses:
 *       200:
 *         description: Lista de tipos de afectación
 */
router.get("/tipo_afectacion", getTipo_afectacion);
router.post("/tipo_afectacion", createTipo_afectacion);

/**
 * @swagger
 * /tipo_afectacion/{id}:
 *   delete:
 *     summary: Eliminar un tipo de afectación
 *     tags: [Nomenclaturas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Registro eliminado
 */
router.delete("/tipo_afectacion/:id", deleteTipo_afectacion);
router.put("/tipo_afectacion/:id", updateTipo_afectacion);

module.exports = router;
