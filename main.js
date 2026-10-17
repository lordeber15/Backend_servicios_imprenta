/**
 * ENTRY POINT DEL BACKEND
 *
 * Este archivo es el punto de entrada principal del servidor Node.js.
 * Responsabilidades:
 * 1. Cargar variables de entorno desde .env
 * 2. Conectar a la base de datos PostgreSQL
 * 3. Verificar que no haya migraciones de esquema pendientes
 * 4. Iniciar el servidor Express en el puerto configurado
 */

require("dotenv").config();

const app = require("./src/infrastructure/web/app.js");
const sequelize = require("./src/infrastructure/database/database");
const { closeBrowser } = require("./src/infrastructure/external_services/browserPool");
const { verificarMigraciones } = require("./src/infrastructure/database/migrator");

// El worker SUNAT corre en su propio proceso: ver worker.js

const port = process.env.PORT || 3000;

let server; // Referencia al servidor HTTP para cerrar en shutdown

async function main() {
  try {
    // El esquema NUNCA se modifica al arrancar: solo con migraciones
    // (servicio `migrate` en docker-compose). Si falta alguna, no se arranca:
    // un modelo desfasado de la tabla produce errores 500 difíciles de rastrear.
    await sequelize.authenticate();
    await verificarMigraciones(sequelize);
    console.log("Conectado a la base de datos (esquema al día)");

    server = app.listen(port, () => {
      console.log("Escuchando en el puerto:", port);
    });
  } catch (error) {
    console.error("Error al iniciar el servidor:", error);
    process.exit(1);
  }
}

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n${signal} recibido. Cerrando servidor...`);
  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log("Servidor HTTP cerrado");
    }
    await sequelize.close();
    console.log("Conexion a BD cerrada");
    await closeBrowser();
    console.log("Puppeteer cerrado");
  } catch (err) {
    console.error("Error durante shutdown:", err);
  }
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ── Errores no capturados ─────────────────────────────────────────────────────
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

main();
