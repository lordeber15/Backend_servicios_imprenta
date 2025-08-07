const { Router } = require("express");
const {
  getEmisor,
  createEmisor,
  deleteEmisor,
  updateEmisor,
} = require("../facturacion/emisor.routes");
const router = Router();

router.get("/emisor", getEmisor);
router.post("/emisor", createEmisor);
router.delete("/emisor/:id", deleteEmisor);
router.put("/emisor/:id", updateEmisor);

module.exports = router;
