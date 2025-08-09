const { Router } = require("express");
const {
  getEgresos,
  deleteEgresos,
  updateEgresos,
  createEgresos,
} = require("../../controllers/ingresosyegresos/egreso.controller");
const router = Router();

router.get("/egresos", getEgresos);
router.post("/egresos", createEgresos);
router.delete("/egresos/:id", deleteEgresos);
router.put("/egresos/:id", updateEgresos);

module.exports = router;
