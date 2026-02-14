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

const app = require("./src/app");
const sequelize = require("./src/database/database");

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

// Ejecutar la función principal
main();
