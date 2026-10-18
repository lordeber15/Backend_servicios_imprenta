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
    estado_previo: DataTypes.STRING(15), // estado del comprobante antes de la baja (para revertir si SUNAT la rechaza)
  },
  { tableName: "ComunicacionBajaDetalle", timestamps: false }
);

module.exports = ComunicacionBajaDetalle;
