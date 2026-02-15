const { Router } = require("express");
const {
  getCuota,
  createCuota,
  deleteCuota,
  updateCuota,
} = require("../../controllers/facturacion/cuota.controller");
const router = Router();

router.get("/cuota", getCuota);
router.post("/cuota", createCuota);
router.delete("/cuota/:id", deleteCuota);
router.put("/cuota/:id", updateCuota);

module.exports = router;
