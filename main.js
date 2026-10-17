/**
 * ENTRY POINT DEL BACKEND
 *
 * Este archivo es el punto de entrada principal del servidor Node.js.
 * Responsabilidades:
 * 1. Cargar variables de entorno desde .env
 * 2. Conectar a la base de datos PostgreSQL
 * 3. Sincronizar modelos de Sequelize con la BD
 * 4. Iniciar el servidor Express en el puerto configurado
 */

require("dotenv").config();

const app = require("./src/infrastructure/web/app.js");
const sequelize = require("./src/infrastructure/database/database");
const { closeBrowser } = require("./src/infrastructure/external_services/browserPool");
const { Formato } = require("./src/infrastructure/database/models/formatos");
require("./src/infrastructure/database/models/usuario_formatos");

// El worker SUNAT corre en su propio proceso: ver worker.js

const port = process.env.PORT || 3000;

let server; // Referencia al servidor HTTP para cerrar en shutdown

async function main() {
  try {
    // En producción NO se altera el esquema automáticamente: sync() solo crea
    // tablas que falten, nunca modifica/elimina columnas existentes (evita
    // cambios destructivos sobre datos de facturación al reiniciar). Los cambios
    // de esquema en prod se gestionan con los SQL de migrations/.
    // En desarrollo se mantiene alter:true por comodidad.
    const isProd = process.env.NODE_ENV === "production";
    await sequelize.sync(isProd ? {} : { alter: true });
    console.log(
      isProd
        ? "Conectado a la base de datos (sync seguro, sin alter)"
        : "Conectado a la base de datos (sync alter:true, desarrollo)"
    );

    // Seed: insertar formatos iniciales si la tabla esta vacia
    const formatosCount = await Formato.count();
    if (formatosCount === 0) {
      await Formato.bulkCreate([
        { key: "ticket", nombre: "Ticket" },
        { key: "boleta", nombre: "Boleta de Venta" },
        { key: "factura", nombre: "Factura" },
        { key: "guiarem", nombre: "Guia de Remision" },
        { key: "guiatransp", nombre: "Guia Transportista" },
        { key: "notacredito", nombre: "Nota de Credito" },
        { key: "ingresos", nombre: "Ingresos y Egresos" },
        { key: "cotizacion", nombre: "Cotizacion" },
      ]);
      console.log("Formatos iniciales creados");
    }

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
