/**
 * MODELO CLIENTE
 * 
 * Gestiona la información de los clientes para la facturación.
 * Incluye el enlace con el tipo de documento (DNI, RUC, etc.).
 */
const { DataTypes } = require("sequelize");
const sequelize = require("../../database");

const Cliente = sequelize.define(
  "Cliente",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tipo_documento_id: {
      type: DataTypes.CHAR(1),
      references: {
        model: "TipoDocumento", // Catálogo de tipos de documento oficiales
        key: "id",
      },
    },
    nrodoc: DataTypes.STRING(15), // Número de documento (DNI o RUC)
    razon_social: DataTypes.STRING(100), // Nombre completo o denominación social
    direccion: DataTypes.STRING(100), // Dirección fiscal o domiciliaria
  },
  {
    tableName: "Cliente",
    timestamps: false,
  }
);

module.exports = Cliente;
