const { Router } = require("express");
const { getReniec } = require("../controllers/reniec.controller.js");
const router = Router();

router.get("/v1/reniec/:dni", getReniec);

module.exports = router;
