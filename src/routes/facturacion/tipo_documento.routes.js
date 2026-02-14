const { Router } = require("express");
const {
  getTipo_documento,
  createTipo_documento,
  deleteTipo_documento,
  updateTipo_documento,
} = require("../../controllers/facturacion/tipo_documento.controller");
const router = Router();

/**
 * @swagger
 * /tipo_documento:
 *   get:
 *     summary: Listar tipos de documento de identidad (DNI, RUC, etc.)
 *     tags: [Nomenclaturas]
 *     responses:
 *       200:
 *         description: Lista de tipos de documento
 */
router.get("/tipo_documento", getTipo_documento);
router.post("/tipo_documento", createTipo_documento);

/**
 * @swagger
 * /tipo_documento/{id}:
 *   delete:
 *     summary: Eliminar un tipo de documento
 *     tags: [Nomenclaturas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Registro eliminado
 */
router.delete("/tipo_documento/:id", deleteTipo_documento);
router.put("/tipo_documento/:id", updateTipo_documento);

module.exports = router;
