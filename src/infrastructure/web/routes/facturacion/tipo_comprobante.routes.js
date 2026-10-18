const { Router } = require("express");
const Tipo_comprobanteModel = require("../../../database/models/facturacion/tipocomprobante");
const soloCampos = require("../../middleware/soloCampos");
const {
  getTipo_comprobante,
  createTipo_comprobante,
  deleteTipo_comprobante,
  updateTipo_comprobante,
} = require("../../controllers/facturacion/tipo_comprobante.controller");
const router = Router();

/**
 * @swagger
 * /tipo_comprobante:
 *   get:
 *     summary: Listar tipos de comprobantes (Boletas, Facturas, etc.)
 *     tags: [Nomenclaturas]
 *     responses:
 *       200:
 *         description: Lista de tipos de comprobantes
 */
router.get("/tipo_comprobante", getTipo_comprobante);
router.post("/tipo_comprobante", soloCampos(Tipo_comprobanteModel), createTipo_comprobante);

/**
 * @swagger
 * /tipo_comprobante/{id}:
 *   delete:
 *     summary: Eliminar un tipo de comprobante
 *     tags: [Nomenclaturas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Tipo eliminado
 */
router.delete("/tipo_comprobante/:id", deleteTipo_comprobante);
router.put("/tipo_comprobante/:id", soloCampos(Tipo_comprobanteModel), updateTipo_comprobante);

module.exports = router;
