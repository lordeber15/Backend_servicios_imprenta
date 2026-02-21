/**
 * @swagger
 * tags:
 *   name: Servicios
 *   description: Gestión de órdenes de trabajo de la imprenta
 */

const { Router } = require("express");
const {
  getServicios,
  createServicios,
  deleteServicios,
  updateServicios,
} = require("../controllers/servicios.controller");

const router = Router();

/**
 * @swagger
 * /servicios:
 *   get:
 *     summary: Obtener todas las órdenes de trabajo
 *     tags: [Servicios]
 *     responses:
 *       200:
 *         description: Lista de servicios obtenida exitosamente
 *   post:
 *     summary: Crear una nueva orden de trabajo
 *     tags: [Servicios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               trabajo:
 *                 type: string
 *               cantidad:
 *                 type: integer
 *               total:
 *                 type: number
 *               acuenta:
 *                 type: number
 *               estado:
 *                 type: string
 *     responses:
 *       201:
 *         description: Servicio creado
 */
router.get("/servicios", getServicios);
router.post("/servicios", createServicios);

/**
 * @swagger
 * /servicios/{id}:
 *   delete:
 *     summary: Eliminar una orden de trabajo
 *     tags: [Servicios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Servicio eliminado
 *   put:
 *     summary: Actualizar una orden de trabajo
 *     tags: [Servicios]
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
 *         description: Servicio actualizado
 */
router.delete("/servicios/:id", deleteServicios);
router.put("/servicios/:id", updateServicios);

module.exports = router;
