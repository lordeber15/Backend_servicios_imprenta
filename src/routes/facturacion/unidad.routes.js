const { Router } = require("express");
const {
  getUnidad,
  createUnidad,
  deleteUnidad,
  updateUnidad,
} = require("../facturacion/unidad.routes");
const router = Router();

router.get("/unidad", getUnidad);
router.post("/unidad", createUnidad);
router.delete("/unidad/:id", deleteUnidad);
router.put("/unidad/:id", updateUnidad);

module.exports = router;
