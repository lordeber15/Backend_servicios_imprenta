/**
 * ENTRY POINT DEL BACKEND
 * 
 * Este archivo es el punto de entrada principal del servidor Node.js.
 * Responsabilidades:
 * 1. Cargar variables de entorno desde .env
 * 2. Conectar a la base de datos PostgreSQL
 * 3. Sincronizar modelos de Sequelize con la BD
 * 4. Iniciar el servidor Express en el puerto configurado
 * 
 * Flujo de inicio:
 * 1. dotenv.config() → Carga variables de entorno
 * 2. sequelize.sync() → Sincroniza modelos con PostgreSQL
 * 3. app.listen() → Inicia servidor HTTP
 */

// Cargar variables de entorno desde archivo .env
require("dotenv").config();

const app = require("./src/infrastructure/web/app.js");
const sequelize = require("./src/infrastructure/database/database");
const { closeBrowser } = require("./src/infrastructure/external_services/browserPool");
const { Formato } = require("./src/infrastructure/database/models/formatos");
require("./src/infrastructure/database/models/usuario_formatos"); // Registrar relaciones

// Puerto del servidor (por defecto 3000 si no está en .env)
const port = process.env.PORT || 3000;

/**
 * Función principal de inicialización del servidor
 * 
 * Proceso:
 * 1. Sincroniza los modelos de Sequelize con PostgreSQL
 * 2. Inicia el servidor Express
 * 3. Maneja errores de conexión
 * 
 * @async
 * @returns {Promise<void>}
 */
async function main() {
  try {
    /**
     * SINCRONIZACIÓN DE BASE DE DATOS
     * 
     * sequelize.sync({ force: false }):
     * - force: false → Preserva datos existentes (PRODUCCIÓN)
     * - force: true → ELIMINA Y RECREA todas las tablas (solo DESARROLLO)
     * 
     * Esto crea automáticamente las tablas basadas en los modelos definidos
     * si no existen, o las actualiza si hay cambios en la estructura.
     */
    await sequelize.sync({ alter: true });
    console.log("Conectado a la base de datos");

    // Seed: insertar formatos iniciales si la tabla está vacía
    const formatosCount = await Formato.count();
    if (formatosCount === 0) {
      await Formato.bulkCreate([
        { key: "ticket", nombre: "Ticket" },
        { key: "boleta", nombre: "Boleta de Venta" },
        { key: "factura", nombre: "Factura" },
        { key: "guiarem", nombre: "Guía de Remisión" },
        { key: "guiatransp", nombre: "Guía Transportista" },
        { key: "notacredito", nombre: "Nota de Crédito" },
        { key: "ingresos", nombre: "Ingresos y Egresos" },
        { key: "cotizacion", nombre: "Cotización" },
      ]);
      console.log("Formatos iniciales creados");
    }
    
    /**
     * INICIO DEL SERVIDOR HTTP
     * 
     * Inicia el servidor Express en el puerto configurado.
     * El servidor queda escuchando peticiones HTTP.
     */
    app.listen(port, () => {
      console.log("Escuchando en el puerto:", port);
    });
  } catch (error) {
    /**
     * MANEJO DE ERRORES
     * 
     * Si falla la conexión a la BD o el inicio del servidor,
     * se registra el error y el proceso continúa (no se detiene).
     */
    console.error("Error al iniciar el servidor:", error);
  }
}

// Cerrar Puppeteer al detener el servidor
process.on("SIGINT", async () => {
  await closeBrowser();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await closeBrowser();
  process.exit(0);
});

// Ejecutar la función principal
main();
