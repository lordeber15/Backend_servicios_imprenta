const { Router } = require("express");
const {
  getCliente,
  createCliente,
  deleteCliente,
  updateCliente,
} = require("../facturacion/cliente.routes");
const router = Router();

router.get("/cliente", getCliente);
router.post("/cliente", createCliente);
router.delete("/cliente/:id", deleteCliente);
router.put("/cliente/:id", updateCliente);

module.exports = router;
