/**
 * @swagger
 * tags:
 *   name: Clientes
 *   description: Gestión del padrón de clientes (DNI/RUC)
 */

const { Router } = require("express");
const {
  getCliente,
  createCliente,
  deleteCliente,
  updateCliente,
} = require("../../controllers/facturacion/cliente.controller");
const router = Router();

/**
 * @swagger
 * /cliente:
 *   get:
 *     summary: Listar todos los clientes
 *     description: Retorna la lista de todos los clientes registrados para la facturación (DNI, RUC, etc.).
 *     tags: [Clientes]
 *     responses:
 *       200:
 *         description: Lista de clientes obtenida exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: integer }
 *                   nrodoc: { type: string, description: "Número de documento (DNI/RUC)" }
 *                   razon_social: { type: string, description: "Nombre o Razón Social" }
 *                   direccion: { type: string }
 *                   tipo_documento_id: { type: string, description: "Código de tipo de documento (01, 06, etc.)" }
 *   post:
 *     summary: Registrar un nuevo cliente
 *     description: Crea un nuevo registro de cliente en la base de datos.
 *     tags: [Clientes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nrodoc, razon_social, tipo_documento_id]
 *             properties:
 *               nrodoc:
 *                 type: string
 *                 example: "20123456789"
 *               razon_social:
 *                 type: string
 *                 example: "MI EMPRESA S.A.C."
 *               direccion:
 *                 type: string
 *                 example: "Av. Las Flores 123"
 *               tipo_documento_id:
 *                 type: string
 *                 description: "01 para DNI, 06 para RUC"
 *                 example: "06"
 *     responses:
 *       201:
 *         description: Cliente creado exitosamente.
 */
router.get("/cliente", getCliente);
router.post("/cliente", createCliente);

/**
 * @swagger
 * /cliente/{id}:
 *   delete:
 *     summary: Eliminar un cliente
 *     description: Elimina permanentemente un cliente del sistema por su ID.
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Cliente eliminado correctamente.
 *       404:
 *         description: Cliente no encontrado.
 */
router.delete("/cliente/:id", deleteCliente);

/**
 * @swagger
 * /cliente/{id}:
 *   put:
 *     summary: Actualizar datos de un cliente
 *     description: Actualiza la información (razón social, dirección, etc.) de un cliente existente.
 *     tags: [Clientes]
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
 *             properties:
 *               nrodoc: { type: string }
 *               razon_social: { type: string }
 *               direccion: { type: string }
 *               tipo_documento_id: { type: string }
 *     responses:
 *       200:
 *         description: Datos del cliente actualizados exitosamente.
 */
router.put("/cliente/:id", updateCliente);


module.exports = router;
