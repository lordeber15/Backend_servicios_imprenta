const { Router } = require("express");
const {
  getEnvio_resumen_detalle,
  createEnvio_resumen_detalle,
  deleteEnvio_resumen_detalle,
  updateEnvio_resumen_detalle,
} = require("../../controllers/facturacion/envio_resumen_detalle.controller");
const router = Router();

// Solo lectura: estas filas las escriben la emisión, el resumen diario y la
// baja. Un CRUD crudo permitiría falsear estados y tickets de SUNAT.

router.get("/envio_resumen_detalle", getEnvio_resumen_detalle);

module.exports = router;
