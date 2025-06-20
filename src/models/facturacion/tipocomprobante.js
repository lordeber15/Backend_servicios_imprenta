const { DataTypes } = require("sequelize");
const sequelize = require("../database/database");

const TipoComprobante = sequelize.define(
  "TipoComprobante",
  {
    id: {
      type: DataTypes.CHAR(2),
      primaryKey: true,
    },
    descripcion: DataTypes.STRING(100),
  },
  {
    tableName: "tipo_comprobante",
    timestamps: false,
  }
);

module.exports = TipoComprobante;
