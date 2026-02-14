/**
 * @swagger
 * tags:
 *   name: Caja POS
 *   description: Punto de Venta - Apertura, Cierre y Control de Efectivo
 */

const { Router } = require("express");
const { abrirCaja, getCajaActual, cerrarCaja, getHistorialCaja, getVentasDia } = require("../../controllers/caja/caja.controller");

const router = Router();

/**
 * @swagger
 * /caja/apertura:
 *   post:
 *     summary: Realizar apertura de caja
 *     description: Registra el monto inicial de efectivo con el que se inicia el turno de venta.
 *     tags: [Caja POS]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - monto_apertura
 *             properties:
 *               monto_apertura:
 *                 type: number
 *                 description: Dinero en efectivo inicial.
 *                 example: 100.00
 *               observacion:
 *                 type: string
 *                 description: Nota opcional sobre la apertura.
 *                 example: "Apertura turno mañana"
 *     responses:
 *       200:
 *         description: Caja abierta exitosamente. Retorna el objeto de la caja creada.
 *       400:
 *         description: Ya existe una caja abierta o el monto es inválido.
 */
router.post("/caja/apertura", abrirCaja);

/**
 * @swagger
 * /caja/actual:
 *   get:
 *     summary: Obtener estado de la caja actual
 *     description: Devuelve los datos de la caja abierta junto con un resumen de ventas (Tickets y Comprobantes) acumulado hasta el momento.
 *     tags: [Caja POS]
 *     responses:
 *       200:
 *         description: Datos de la caja y ventas del turno.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 caja:
 *                   type: object
 *                   description: Datos de la apertura.
 *                 ventas_tickets:
 *                   type: number
 *                 ventas_comprobantes:
 *                   type: number
 *                 total_ventas_preview:
 *                   type: number
 */
router.get("/caja/actual", getCajaActual);

/**
 * @swagger
 * /caja/{id}/cierre:
 *   put:
 *     summary: Realizar cierre de caja
 *     description: Finaliza el turno de caja, registrando el efectivo contado físicamente y calculando descuadres (faltantes/sobrantes).
 *     tags: [Caja POS]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID del registro de apertura de caja.
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - monto_cierre_fisico
 *             properties:
 *               monto_cierre_fisico:
 *                 type: number
 *                 description: Total de dinero contado físicamente.
 *                 example: 550.50
 *               observacion:
 *                 type: string
 *                 description: Nota sobre el cierre (ej. justificación de faltante).
 *     responses:
 *       200:
 *         description: Caja cerrada con balance calculado.
 *       404:
 *         description: Caja no encontrada.
 */
router.put("/caja/:id/cierre", cerrarCaja);

/**
 * @swagger
 * /caja/historial:
 *   get:
 *     summary: Ver historial de aperturas y cierres
 *     description: Retorna los últimos 30 registros de movimientos de caja (aperturas y cierres).
 *     tags: [Caja POS]
 *     responses:
 *       200:
 *         description: Lista de registros históricos.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */
router.get("/caja/historial", getHistorialCaja);


/**
 * @swagger
 * /ventas/dia:
 *   get:
 *     summary: Obtener ventas del día (tickets, boletas, facturas)
 *     tags: [Caja POS]
 *     parameters:
 *       - in: query
 *         name: fecha
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha a consultar (YYYY-MM-DD, default hoy)
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [all, ticket, boleta, factura]
 *         description: Filtrar por tipo de documento
 *     responses:
 *       200:
 *         description: Lista de ventas y totales
 */
router.get("/ventas/dia", getVentasDia);

module.exports = router;
