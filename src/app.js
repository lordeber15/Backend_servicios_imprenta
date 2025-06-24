const express = require("express");
const serviciosRoutes = require("./routes/servicios.routes");
const login = require("./routes/login.routes");
const reniec = require("./routes/reniec.routes");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());
app.use(serviciosRoutes);
app.use(login);
app.use(reniec);

module.exports = app;
