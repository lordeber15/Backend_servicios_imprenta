const { Router } = require("express");
const authenticate = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/authorize.middleware");
const {
  getComprobante,
  emitirComprobanteCompleto,
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

/**
 * @swagger
 * /comprobante/emision:
 *   post:
 *     summary: Emitir factura, boleta o nota de crédito (transaccional)
 *     description: >
 *       Crea cliente (si falta), cabecera, detalles y cuota en una transacción.
 *       El servidor asigna el correlativo y calcula los montos; luego firma y
 *       encola el envío a SUNAT. No acepta correlativo, totales ni estado.
 *     tags: [SUNAT]
 *     responses:
 *       201: { description: Comprobante creado y encolado }
 *       400: { description: Datos inválidos }
 *       409: { description: Conflicto de numeración o estado }
 */
router.post("/comprobante/emision", authenticate, emitirComprobanteCompleto);

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
router.delete("/comprobante/:id", authenticate, authorize("Administrador"), deleteComprobante);
router.put("/comprobante/:id", authenticate, authorize("Administrador"), updateComprobante);

module.exports = router;
