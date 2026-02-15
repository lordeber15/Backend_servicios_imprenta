const { DataTypes } = require("sequelize");
const sequelize = require("../../database");

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
    tableName: "TipoComprobante",
    timestamps: false,
  }
);

module.exports = TipoComprobante;
