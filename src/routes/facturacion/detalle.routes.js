const { Router } = require("express");
const {
  getDetalle,
  createDetalle,
  deleteDetalle,
  updateDetalle,
} = require("../facturacion/detalle.routes");
const router = Router();

router.get("/detalle", getDetalle);
router.post("/detalle", createDetalle);
router.delete("/detalle/:id", deleteDetalle);
router.put("/detalle/:id", updateDetalle);

module.exports = router;
