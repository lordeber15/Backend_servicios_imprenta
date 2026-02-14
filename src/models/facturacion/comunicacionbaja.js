"use strict";
const { DataTypes } = require("sequelize");
const sequelize = require("../../database/database");

// Comunicación de Baja (RA): para anular Facturas/NC/ND ya aceptadas por SUNAT.
// Las Boletas se anulan mediante un Resumen Diario (RC) con condición=3.
const ComunicacionBaja = sequelize.define(
  "ComunicacionBaja",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    emisor_id: {
      type: DataTypes.INTEGER,
      references: { model: "Emisor", key: "id" },
    },
    correlativo: DataTypes.INTEGER, // correlativo del RA del día
    fecha_emision: DataTypes.DATEONLY, // fecha del lote RA
    fecha_referencia: DataTypes.DATEONLY, // fecha de los comprobantes a anular
    nombre_xml: DataTypes.STRING(60), // {RUC}-RA-{YYYYMMDD}-{N}
    ticket: DataTypes.STRING(50),
    // PE=Pendiente, PR=Procesado OK, ER=Error
    estado_ticket: { type: DataTypes.CHAR(2), defaultValue: "PE" },
    codigo_sunat: DataTypes.STRING(10),
    mensaje_sunat: DataTypes.STRING(500),
    fecha_envio: DataTypes.DATE,
  },
  { tableName: "ComunicacionBaja", timestamps: false }
);

module.exports = ComunicacionBaja;
