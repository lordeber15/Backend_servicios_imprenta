const { Router } = require("express");
const {
  getAlmanaque,
  createAlmanaque,
  deleteAlmanaque,
  updateAlmanaque,
  getAlmanaqueById,
} = require("../../controllers/almanaque/almanaque.controller");
const router = Router();

router.get("/almanaque", getAlmanaque);
router.get("/almanaque/:id", getAlmanaqueById);
router.post("/almanaque", createAlmanaque);
router.delete("/almanaque/:id", deleteAlmanaque);
router.put("/almanaque/:id", updateAlmanaque);

module.exports = router;
