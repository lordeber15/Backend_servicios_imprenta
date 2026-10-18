const { Router } = require("express");
const Tipo_afectacionModel = require("../../../database/models/facturacion/tipoafectacion");
const soloCampos = require("../../middleware/soloCampos");
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
router.post("/tipo_afectacion", soloCampos(Tipo_afectacionModel), createTipo_afectacion);

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
router.put("/tipo_afectacion/:id", soloCampos(Tipo_afectacionModel), updateTipo_afectacion);

module.exports = router;
