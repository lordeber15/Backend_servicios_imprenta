const { Router } = require("express");
const {
  getServicios,
  createServicios,
  deleteServicios,
  updateServicios,
} = require("../controllers/servicios.controller.js");
const router = Router();

router.get("/servicios", getServicios);
router.post("/servicios", createServicios);
router.delete("/servicios/:id", deleteServicios);
router.put("/servicios/:id", updateServicios);

module.exports = router;
