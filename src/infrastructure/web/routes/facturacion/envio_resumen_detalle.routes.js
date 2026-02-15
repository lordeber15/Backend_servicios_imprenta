const { Router } = require("express");
const {
  getEnvio_resumen_detalle,
  createEnvio_resumen_detalle,
  deleteEnvio_resumen_detalle,
  updateEnvio_resumen_detalle,
} = require("../../controllers/facturacion/envio_resumen_detalle.controller");
const router = Router();

router.get("/envio_resumen_detalle", getEnvio_resumen_detalle);
router.post("/envio_resumen_detalle", createEnvio_resumen_detalle);
router.delete("/envio_resumen_detalle/:id", deleteEnvio_resumen_detalle);
router.put("/envio_resumen_detalle/:id", updateEnvio_resumen_detalle);

module.exports = router;
