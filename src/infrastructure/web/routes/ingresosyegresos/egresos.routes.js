const { Router } = require("express");
const {
  getEgresos,
  deleteEgresos,
  updateEgresos,
  createEgresos,
} = require("../../controllers/ingresosyegresos/egreso.controller");
const router = Router();

/**
 * @swagger
 * /egresos:
 *   get:
 *     summary: Listar todos los egresos de caja
 *     tags: [Caja]
 *     responses:
 *       200:
 *         description: Lista de egresos
 *   post:
 *     summary: Registrar un nuevo egreso
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
 *         description: Egreso registrado
 */
router.get("/egresos", getEgresos);
router.post("/egresos", createEgresos);

/**
 * @swagger
 * /egresos/{id}:
 *   delete:
 *     summary: Eliminar un registro de egreso
 *     tags: [Caja]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Registro eliminado
 *   put:
 *     summary: Actualizar un registro de egreso
 *     tags: [Caja]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Registro actualizado
 */
router.delete("/egresos/:id", deleteEgresos);
router.put("/egresos/:id", updateEgresos);

module.exports = router;
