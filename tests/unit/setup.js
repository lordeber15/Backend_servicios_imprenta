// Entorno de las pruebas unitarias: sin BD, Redis ni red. Solo valores de prueba.
const crypto = require("crypto");
process.env.NODE_ENV = "test";
process.env.TZ = "UTC"; // el proceso real corre en UTC (convención de fechas)
process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
process.env.DB_NAME = "sin_bd";
