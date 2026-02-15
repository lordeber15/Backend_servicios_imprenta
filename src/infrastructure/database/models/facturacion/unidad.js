/**
 * MODELO UNIDAD
 * 
 * Representa el catálogo de unidades de medida (Ej: NIU para unidades, KGM para kilos).
 * Es fundamental para la emisión de comprobantes electrónicos de SUNAT.
 */
const { DataTypes } = require("sequelize");
const sequelize = require("../../database");

const Unidad = sequelize.define(
  "Unidad",
  {
    id: {
      type: DataTypes.CHAR(3), // Código de 3 dígitos (Ej: NIU)
      primaryKey: true,
    },
    descripcion: DataTypes.STRING(50), // Nombre legible de la unidad
  },
  {
    tableName: "Unidad",
    timestamps: false,
  }
);

module.exports = Unidad;
