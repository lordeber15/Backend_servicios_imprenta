const { Router } = require("express");
const {
  getTickets,
  createTicket,
  deleteTicket,
  updateTicket,
} = require("../../controllers/Tickets/ticket.controller");
const router = Router();

router.get("/ticket", getTickets);
router.post("/ticket", createTicket);
router.delete("/ticket/:id", deleteTicket);
router.put("/ticket/:id", updateTicket);

module.exports = router;
