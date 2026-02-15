/**
 * CONFIGURACIÓN DE SEQUELIZE Y POSTGRESQL
 * 
 * Este archivo configura la conexión a la base de datos PostgreSQL
 * usando Sequelize como ORM (Object-Relational Mapping).
 * 
 * Sequelize permite:
 * - Definir modelos como clases JavaScript
 * - Realizar consultas sin SQL directo
 * - Manejar relaciones entre tablas
 * - Sincronizar modelos con la BD automáticamente
 * 
 * Variables de entorno requeridas (.env):
 * - DB_NAME: Nombre de la base de datos
 * - DB_USER: Usuario de PostgreSQL
 * - DB_PASSWORD: Contraseña del usuario
 * - DB_HOST: Host del servidor (default: localhost)
 * - DB_PORT: Puerto de PostgreSQL (default: 5432)
 */

const Sequelize = require("sequelize");

/**
 * Instancia de Sequelize
 * 
 * Parámetros de conexión:
 * 1. database: Nombre de la BD (desde .env)
 * 2. username: Usuario de PostgreSQL (desde .env)
 * 3. password: Contraseña (desde .env)
 * 4. options: Configuración adicional
 * 
 * Opciones configuradas:
 * - host: Servidor de BD (localhost en desarrollo)
 * - port: Puerto de PostgreSQL (5432 por defecto)
 * - dialect: Tipo de BD (postgres)
 * - logging: false → No muestra queries SQL en consola
 */
const sequelize = new Sequelize(
  process.env.DB_NAME,      // Nombre de la base de datos
  process.env.DB_USER,      // Usuario de PostgreSQL
  process.env.DB_PASSWORD,  // Contraseña
  {
    host: process.env.DB_HOST || "localhost",           // Host del servidor
    port: parseInt(process.env.DB_PORT || "5432"),      // Puerto de PostgreSQL
    dialect: "postgres",                                 // Dialecto SQL
    logging: false,                                      // Desactiva logs de queries
    
    /**
     * CONFIGURACIÓN SSL PARA PRODUCCIÓN
     * 
     * Descomentar estas opciones si la BD en producción requiere SSL.
     * Común en servicios como AWS RDS, Heroku Postgres, etc.
     * 
     * dialectOptions: {
     *   ssl: {
     *     require: true,              // Requiere conexión SSL
     *     rejectUnauthorized: false,  // Acepta certificados autofirmados
     *   },
     * },
     */
  }
);

// Exportar instancia de Sequelize para usar en modelos y controllers
module.exports = sequelize;
