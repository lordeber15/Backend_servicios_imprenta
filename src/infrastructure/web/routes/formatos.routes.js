const { Router } = require("express");
const {
  getFormatos,
  getUsuarioFormatos,
  updateUsuarioFormatos,
} = require("../controllers/formatos.controller");
const authenticate = require("../middleware/auth.middleware");
const { authorize, authorizeSelfOrAdmin } = require("../middleware/authorize.middleware");

const router = Router();

router.get("/formatos", authenticate, getFormatos);
// Ver los formatos: el propio usuario o un admin. Asignarlos: solo admin
// (antes cualquiera podía habilitarse formatos a sí mismo).
router.get("/formatos/usuario/:id", authenticate, authorizeSelfOrAdmin("id"), getUsuarioFormatos);
router.put("/formatos/usuario/:id", authenticate, authorize("Administrador"), updateUsuarioFormatos);

module.exports = router;
