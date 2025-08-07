const { Router } = require("express");
const {
  getEnvio_resumen,
  createEnvio_resumen,
  deleteEnvio_resumen,
  updateEnvio_resumen,
} = require("../facturacion/envio_resumen.routes");
const router = Router();

router.get("/envio_resumen", getEnvio_resumen);
router.post("/envio_resumen", createEnvio_resumen);
router.delete("/envio_resumen/:id", deleteEnvio_resumen);
router.put("/envio_resumen/:id", updateEnvio_resumen);

module.exports = router;
