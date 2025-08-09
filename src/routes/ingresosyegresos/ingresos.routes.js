const { Router } = require("express");
const {
  getIngreso,
  createIngreso,
  deleteIngreso,
  updateIngreso,
} = require("../../controllers/ingresosyegresos/ingreso.controller");
const router = Router();

router.get("/ingresos", getIngreso);
router.post("/ingresos", createIngreso);
router.delete("/ingresos/:id", deleteIngreso);
router.put("/ingresos/:id", updateIngreso);

module.exports = router;
