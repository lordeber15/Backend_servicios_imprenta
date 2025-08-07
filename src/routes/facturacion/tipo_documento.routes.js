const { Router } = require("express");
const {
  getTipo_documento,
  createTipo_documento,
  deleteTipo_documento,
  updateTipo_documento,
} = require("../../controllers/facturacion/tipo_documento.controller");
const router = Router();

router.get("/tipo_documento", getTipo_documento);
router.post("/tipo_documento", createTipo_documento);
router.delete("/tipo_documento/:id", deleteTipo_documento);
router.put("/tipo_documento/:id", updateTipo_documento);

module.exports = router;
