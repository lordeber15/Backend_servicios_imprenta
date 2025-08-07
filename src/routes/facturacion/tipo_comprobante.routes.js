const { Router } = require("express");
const {
  getTipo_comprobante,
  createTipo_comprobante,
  deleteTipo_comprobante,
  updateTipo_comprobante,
} = require("../../controllers/facturacion/tipo_comprobante.controller");
const router = Router();

router.get("/tipo_comprobante", getTipo_comprobante);
router.post("/tipo_comprobante", createTipo_comprobante);
router.delete("/tipo_comprobante/:id", deleteTipo_comprobante);
router.put("/tipo_comprobante/:id", updateTipo_comprobante);

module.exports = router;
