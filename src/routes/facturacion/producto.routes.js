/**
 * @swagger
 * tags:
 *   name: Productos
 *   description: Gestión de inventario y catálogo de productos
 */

const { Router } = require("express");
const {
  getProducto,
  createProducto,
  deleteProducto,
  updateProducto,
} = require("../../controllers/facturacion/producto.controller");
const router = Router();

/**
 * @swagger
 * /producto:
 *   get:
 *     summary: Listar productos del inventario
 *     tags: [Productos]
 *     responses:
 *       200:
 *         description: Lista de productos obtenida
 *   post:
 *     summary: Crear un nuevo producto
 *     tags: [Productos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               descripcion:
 *                 type: string
 *               valor_unitario:
 *                 type: number
 *               tipo_afectacion_id:
 *                 type: string
 *               unidad_id:
 *                 type: string
 *               stock:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Producto creado
 */
router.get("/producto", getProducto);
router.post("/producto", createProducto);

/**
 * @swagger
 * /producto/{id}:
 *   delete:
 *     summary: Eliminar un producto
 *     tags: [Productos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Producto eliminado
 *   put:
 *     summary: Actualizar datos de un producto
 *     tags: [Productos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Producto actualizado
 */
router.delete("/producto/:id", deleteProducto);
router.put("/producto/:id", updateProducto);

module.exports = router;
