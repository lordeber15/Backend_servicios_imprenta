const { Router } = require("express");
const authenticate = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/authorize.middleware");
const {
  getDetalle,
  deleteDetalle,
  updateDetalle,
} = require("../../controllers/facturacion/detalle.controller");
const router = Router();

// POST /detalle ya no existe: los detalles se crean con POST /comprobante/emision.
router.get("/detalle", getDetalle);
router.delete("/detalle/:id", authenticate, authorize("Administrador"), deleteDetalle);
router.put("/detalle/:id", authenticate, authorize("Administrador"), updateDetalle);

module.exports = router;
