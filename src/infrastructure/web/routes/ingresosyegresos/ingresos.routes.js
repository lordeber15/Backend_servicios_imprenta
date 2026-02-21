/**
 * @swagger
 * tags:
 *   name: Caja
 *   description: Registro de movimientos de caja (Ingresos y Egresos)
 */

const { Router } = require("express");
const {
  getIngreso,
  createIngreso,
  deleteIngreso,
  updateIngreso,
} = require("../../controllers/ingresosyegresos/ingreso.controller");
const router = Router();

/**
 * @swagger
 * /ingresos:
 *   get:
 *     summary: Listar todos los ingresos de caja
 *     tags: [Caja]
 *     responses:
 *       200:
 *         description: Lista de ingresos
 *   post:
 *     summary: Registrar un nuevo ingreso
 *     tags: [Caja]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               monto:
 *                 type: number
 *               descripcion:
 *                 type: string
 *               fecha:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Ingreso registrado
 */
router.get("/ingresos", getIngreso);
router.post("/ingresos", createIngreso);

/**
 * @swagger
 * /ingresos/{id}:
 *   delete:
 *     summary: Eliminar un registro de ingreso
 *     tags: [Caja]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Registro eliminado
 *   put:
 *     summary: Actualizar un registro de ingreso
 *     tags: [Caja]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Registro actualizado
 */
router.delete("/ingresos/:id", deleteIngreso);
router.put("/ingresos/:id", updateIngreso);

module.exports = router;
