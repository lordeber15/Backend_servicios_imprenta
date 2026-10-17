/**
 * ENTRY POINT DEL WORKER SUNAT
 *
 * Corre como proceso (y contenedor) separado de la API: si la API cae por un
 * PDF pesado o un error de Puppeteer, el envío a SUNAT sigue funcionando, y
 * viceversa. Consume la cola "sunat-envio" de BullMQ.
 *
 * No modifica el esquema: eso lo hacen las migraciones (servicio `migrate`).
 */

require("dotenv").config();

const sequelize = require("./src/infrastructure/database/database");
const { verificarMigraciones } = require("./src/infrastructure/database/migrator");

async function main() {
  try {
    await sequelize.authenticate();
    await verificarMigraciones(sequelize);
    console.log("[Worker] Conectado a la base de datos (esquema al día)");
  } catch (error) {
    console.error("[Worker] No se puede arrancar:", error.message);
    process.exit(1);
  }

  // El Worker de BullMQ empieza a consumir al instanciarse (al hacer require).
  const sunatWorker = require("./src/workers/sunatWorker");
  console.log("[Worker] Worker SUNAT activo (concurrency: 3)");

  async function shutdown(signal) {
    console.log(`\n[Worker] ${signal} recibido. Cerrando...`);
    try {
      // close() espera a que terminen los jobs en curso antes de salir.
      await sunatWorker.close();
      await sequelize.close();
    } catch (err) {
      console.error("[Worker] Error durante shutdown:", err);
    }
    process.exit(0);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

process.on("unhandledRejection", (reason) => {
  console.error("[Worker] Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[Worker] Uncaught Exception:", err);
  process.exit(1);
});

main();
