const { Router } = require("express");
const {
  getProducto,
  createProducto,
  deleteProducto,
  updateProducto,
} = require("../../controllers/facturacion/producto.controller");
const router = Router();

router.get("/producto", getProducto);
router.post("/producto", createProducto);
router.delete("/producto/:id", deleteProducto);
router.put("/producto/:id", updateProducto);

module.exports = router;
