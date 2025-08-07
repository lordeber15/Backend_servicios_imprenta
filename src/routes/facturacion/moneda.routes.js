const { Router } = require("express");
const {
  getMoneda,
  createMoneda,
  deleteMoneda,
  updateMoneda,
} = require("../facturacion/moneda.routes");
const router = Router();

router.get("/moneda", getMoneda);
router.post("/moneda", createMoneda);
router.delete("/moneda/:id", deleteMoneda);
router.put("/moneda/:id", updateMoneda);

module.exports = router;
