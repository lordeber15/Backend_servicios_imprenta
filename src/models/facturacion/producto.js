const { DataTypes } = require("sequelize");
const sequelize = require("../../database/database");

const Producto = sequelize.define(
  "Producto",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: DataTypes.STRING(255),
    valor_unitario: DataTypes.DECIMAL(15, 6),
    tipo_afectacion_id: {
      type: DataTypes.CHAR(2),
      references: {
        model: "TipoAfectacion",
        key: "id",
      },
    },
    unidad_id: {
      type: DataTypes.CHAR(3),
      references: {
        model: "Unidad",
        key: "id",
      },
    },
    codigo_sunat: DataTypes.STRING(12),
    afecto_icbper: DataTypes.SMALLINT,
    factor_icbper: DataTypes.DECIMAL(15, 2),
  },
  {
    tableName: "Producto",
    timestamps: false,
  }
);

module.exports = Producto;
