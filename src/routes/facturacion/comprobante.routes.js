const { Router } = require("express");
const {
  getComprobante,
  createComprobante,
  deleteComprobante,
  updateComprobante,
} = require("../../controllers/facturacion/comprobante.controller");
const router = Router();

/**
 * @swagger
 * /comprobante:
 *   get:
 *     summary: Listar registros de comprobantes locales
 *     tags: [SUNAT]
 *     responses:
 *       200:
 *         description: Lista de comprobantes almacenados
 */
router.get("/comprobante", getComprobante);
router.post("/comprobante", createComprobante);

/**
 * @swagger
 * /comprobante/{id}:
 *   delete:
 *     summary: Eliminar registro de comprobante
 *     tags: [SUNAT]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Registro eliminado
 */
router.delete("/comprobante/:id", deleteComprobante);
router.put("/comprobante/:id", updateComprobante);

module.exports = router;
