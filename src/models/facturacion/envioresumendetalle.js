const { DataTypes } = require("sequelize");
const sequelize = require("../database/database");

const EnvioResumenDetalle = sequelize.define(
  "EnvioResumenDetalle",
  {
    iddetalle: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    envio_id: {
      type: DataTypes.INTEGER,
      references: {
        model: "EnvioResumen",
        key: "id",
      },
    },
    comprobante_id: {
      type: DataTypes.INTEGER,
      references: {
        model: "Comprobante",
        key: "id",
      },
    },
    condicion: DataTypes.SMALLINT,
  },
  {
    tableName: "envio_resumen_detalle",
    timestamps: false,
  }
);

module.exports = EnvioResumenDetalle;
