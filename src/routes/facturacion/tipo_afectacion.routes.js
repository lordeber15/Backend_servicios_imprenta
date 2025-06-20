const { Router } = require("express");
const {
  getTipo_afectacion,
  createTipo_afectacion,
  deleteTipo_afectacion,
  updateTipo_afectacion,
} = require("../facturacion/tipo_afectacion.routes");
const router = Router();

router.get("/tipo_afectacion", getTipo_afectacion);
router.post("/tipo_afectacion", createTipo_afectacion);
router.delete("/tipo_afectacion/:id", deleteTipo_afectacion);
router.put("/tipo_afectacion/:id", updateTipo_afectacion);

module.exports = router;
