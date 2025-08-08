const { Router } = require("express");
const { getReniec } = require("../controllers/reniec.controller.js");
const router = Router();

router.get("/api/reniec/:dni", getReniec);

module.exports = router;
