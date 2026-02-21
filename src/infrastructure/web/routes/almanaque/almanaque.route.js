/**
 * @swagger
 * tags:
 *   name: Almanaque
 *   description: Gestión de pedidos y producción de almanaques
 */

const { Router } = require("express");
const {
  getAlmanaque,
  createAlmanaque,
  deleteAlmanaque,
  updateAlmanaque,
  getAlmanaqueById,
  getCotizacionPdf,
} = require("../../controllers/almanaque/almanaque.controller");
const router = Router();

/**
 * @swagger
 * /almanaque:
 *   get:
 *     summary: Listar todas las órdenes de almanaques
 *     tags: [Almanaque]
 *     responses:
 *       200:
 *         description: Lista de almanaques
 *   post:
 *     summary: Crear un nuevo pedido de almanaque
 *     tags: [Almanaque]
 *     responses:
 *       201:
 *         description: Pedido creado
 */
router.get("/almanaque", getAlmanaque);
router.post("/almanaque", createAlmanaque);

/**
 * @swagger
 * /almanaque/{id}:
 *   get:
 *     summary: Obtener detalles de un pedido de almanaque
 *     tags: [Almanaque]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Detalles del pedido
 *   delete:
 *     summary: Eliminar un pedido de almanaque
 *     tags: [Almanaque]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Pedido eliminado
 *   put:
 *     summary: Actualizar un pedido de almanaque
 *     tags: [Almanaque]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Pedido actualizado
 */
router.get("/almanaque/:id/pdf", getCotizacionPdf);
router.get("/almanaque/:id", getAlmanaqueById);
router.delete("/almanaque/:id", deleteAlmanaque);
router.put("/almanaque/:id", updateAlmanaque);

module.exports = router;
