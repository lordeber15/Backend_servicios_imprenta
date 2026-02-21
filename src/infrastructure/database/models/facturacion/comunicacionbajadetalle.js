"use strict";
const { DataTypes } = require("sequelize");
const sequelize = require("../../database");

// Cada comprobante individual incluido en una Comunicación de Baja (RA)
const ComunicacionBajaDetalle = sequelize.define(
  "ComunicacionBajaDetalle",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    baja_id: {
      type: DataTypes.INTEGER,
      references: { model: "ComunicacionBaja", key: "id" },
    },
    comprobante_id: {
      type: DataTypes.INTEGER,
      references: { model: "Comprobante", key: "id" },
    },
    tipo_comprobante_id: DataTypes.CHAR(2),
    serie: DataTypes.STRING(4),
    correlativo: DataTypes.INTEGER,
    motivo_baja: DataTypes.STRING(100),
  },
  { tableName: "ComunicacionBajaDetalle", timestamps: false }
);

module.exports = ComunicacionBajaDetalle;
