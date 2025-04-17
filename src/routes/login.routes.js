const { Router } = require("express");
const {
  getLogin,
  createLogin,
  deleteLogin,
  updateLogin,
} = require("../controllers/login.controlles");
const router = Router();

router.get("/login", getLogin);
router.post("/login", createLogin);
router.delete("/login/:id", deleteLogin);
router.put("/login/:id", updateLogin);

module.exports = router;
