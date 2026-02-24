const { Router } = require("express");
const {
  getFormatos,
  getUsuarioFormatos,
  updateUsuarioFormatos,
} = require("../controllers/formatos.controller");
const authenticate = require("../middleware/auth.middleware");

const router = Router();

router.get("/formatos", authenticate, getFormatos);
router.get("/formatos/usuario/:id", authenticate, getUsuarioFormatos);
router.put("/formatos/usuario/:id", authenticate, updateUsuarioFormatos);

module.exports = router;
