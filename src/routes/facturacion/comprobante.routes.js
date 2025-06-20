const { Router } = require("express");
const {
  getComprobante,
  createComprobante,
  deleteComprobante,
  updateComprobante,
} = require("../facturacion/comprobante.routes");
const router = Router();

router.get("/comprobante", getComprobante);
router.post("/comprobante", createComprobante);
router.delete("/comprobante/:id", deleteComprobante);
router.put("/comprobante/:id", updateComprobante);

module.exports = router;
