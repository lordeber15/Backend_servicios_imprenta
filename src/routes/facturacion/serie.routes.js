const { Router } = require("express");
const {
  getSerie,
  createSerie,
  deleteSerie,
  updateSerie,
} = require("../facturacion/serie.routes");
const router = Router();

router.get("/serie", getSerie);
router.post("/serie", createSerie);
router.delete("/serie/:id", deleteSerie);
router.put("/serie/:id", updateSerie);

module.exports = router;
