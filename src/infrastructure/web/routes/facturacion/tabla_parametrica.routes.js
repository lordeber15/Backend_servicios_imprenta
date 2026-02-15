const { Router } = require("express");
const {
  getTabla_parametrica,
  createTabla_parametrica,
  deleteTabla_parametrica,
  updateTabla_parametrica,
} = require("../../controllers/facturacion/tabla_parametrica.controller");
const router = Router();

router.get("/tabla_parametrica", getTabla_parametrica);
router.post("/tabla_parametrica", createTabla_parametrica);
router.delete("/tabla_parametrica/:id", deleteTabla_parametrica);
router.put("/tabla_parametrica/:id", updateTabla_parametrica);

module.exports = router;
