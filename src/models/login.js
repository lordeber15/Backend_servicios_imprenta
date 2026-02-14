/**
 * MODELO DE USUARIOS (LOGIN)
 * 
 * Este modelo define la estructura de la tabla 'login' en PostgreSQL
 * que almacena los usuarios del sistema.
 * 
 * Tabla: login
 * Campos:
 * - id: Identificador único (auto-incremental)
 * - usuario: Nombre de usuario
 * - password: Contraseña (debe hashearse antes de guardar)
 * - cargo: Rol del usuario (Administrador, Usuario)
 * 
 * Sequelize automáticamente agrega:
 * - createdAt: Fecha de creación
 * - updatedAt: Fecha de última actualización
 */

const { DataTypes } = require("sequelize");
const sequelize = require("../database/database");

/**
 * Definición del modelo Login
 * 
 * sequelize.define(nombreTabla, campos, opciones)
 * - nombreTabla: 'login' → Tabla en PostgreSQL
 * - campos: Definición de columnas con tipos y restricciones
 * - opciones: Configuración adicional (timestamps, etc.)
 */
const Login = sequelize.define("login", {
  /**
   * ID - Clave primaria
   * 
   * - type: INTEGER → Número entero
   * - primaryKey: true → Es la clave primaria
   * - autoIncrement: true → Se incrementa automáticamente
   * 
   * PostgreSQL: SERIAL PRIMARY KEY
   */
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  
  /**
   * USUARIO - Nombre de usuario
   * 
   * - type: STRING → VARCHAR(255) en PostgreSQL
   * - allowNull: false → Campo obligatorio (NOT NULL)
   * 
   * Usado para login y identificación del usuario
   */
  usuario: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  
  /**
   * PASSWORD - Contraseña
   * 
   * - type: STRING → VARCHAR(255) en PostgreSQL
   * - allowNull: false → Campo obligatorio (NOT NULL)
   * 
   * IMPORTANTE: Debe hashearse con bcrypt antes de guardar
   * Nunca almacenar contraseñas en texto plano
   */
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  
  /**
   * CARGO - Rol del usuario
   * 
   * Valores posibles:
   * - "Administrador": Acceso completo al sistema
   * - "Usuario": Acceso limitado
   */
  cargo: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  
  /**
   * IMAGE_URL - Ruta de la foto de perfil
   * 
   * Almacena la ruta relativa a la imagen subida.
   */
  image_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  /**
   * ACTIVO - Estado del usuario (Eliminación Lógica)
   * 
   * true: Usuario activo y puede loguearse
   * false: Usuario desactivado, acceso denegado
   */
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
});

// Exportar modelo para usar en controllers y routes
module.exports = { Login };
