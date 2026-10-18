const { Router } = require("express");
const {
  getCuota,
  createCuota,
  deleteCuota,
  updateCuota,
} = require("../../controllers/facturacion/cuota.controller");
const router = Router();

// Solo lectura: estas filas las escriben la emisión, el resumen diario y la
// baja. Un CRUD crudo permitiría falsear estados y tickets de SUNAT.

router.get("/cuota", getCuota);

module.exports = router;
