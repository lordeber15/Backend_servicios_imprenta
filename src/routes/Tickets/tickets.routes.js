/**
 * @swagger
 * tags:
 *   name: Tickets
 *   description: Gestión de tickets internos y de venta rápida
 */

const { Router } = require("express");
const {
  getTickets,
  createTicket,
  deleteTicket,
  updateTicket,
  getTicketPdf,
} = require("../../controllers/Tickets/ticket.controller");
const router = Router();

/**
 * @swagger
 * /ticket:
 *   get:
 *     summary: Listar todos los tickets
 *     tags: [Tickets]
 *     responses:
 *       200:
 *         description: Lista de tickets
 *   post:
 *     summary: Crear un nuevo ticket
 *     tags: [Tickets]
 *     responses:
 *       201:
 *         description: Ticket creado
 */
router.get("/ticket", getTickets);
router.post("/ticket", createTicket);

/**
 * @swagger
 * /ticket/{id}:
 *   delete:
 *     summary: Eliminar un ticket
 *     tags: [Tickets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Ticket eliminado
 *   put:
 *     summary: Actualizar un ticket
 *     tags: [Tickets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Ticket actualizado
 */
router.get("/ticket/:id/pdf", getTicketPdf);
router.delete("/ticket/:id", deleteTicket);
router.put("/ticket/:id", updateTicket);

module.exports = router;
