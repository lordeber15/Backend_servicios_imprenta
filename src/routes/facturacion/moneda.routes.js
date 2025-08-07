const { Router } = require("express");
const {
  getMoneda,
  createMoneda,
  deleteMoneda,
  updateMoneda,
} = require("../../controllers/facturacion/moneda.controller");
const router = Router();

router.get("/moneda", getMoneda);
router.post("/moneda", createMoneda);
router.delete("/moneda/:id", deleteMoneda);
router.put("/moneda/:id", updateMoneda);

module.exports = router;
