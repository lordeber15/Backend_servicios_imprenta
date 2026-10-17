/**
 * ENTRY POINT DEL WORKER SUNAT
 *
 * Corre como proceso (y contenedor) separado de la API: si la API cae por un
 * PDF pesado o un error de Puppeteer, el envío a SUNAT sigue funcionando, y
 * viceversa. Consume las colas "sunat-envio" (comprobantes) y "sunat-guia"
 * (consulta de tickets de guías) de BullMQ.
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

  // Los Worker de BullMQ empiezan a consumir al instanciarse (al hacer require).
  const sunatWorker = require("./src/workers/sunatWorker");
  const guiaWorker = require("./src/workers/guiaWorker");
  console.log("[Worker] Workers activos: sunat-envio (concurrency 3), sunat-guia (concurrency 2)");

  async function shutdown(signal) {
    console.log(`\n[Worker] ${signal} recibido. Cerrando...`);
    try {
      // close() espera a que terminen los jobs en curso antes de salir.
      await Promise.all([sunatWorker.close(), guiaWorker.close()]);
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
