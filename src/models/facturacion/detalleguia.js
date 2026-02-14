"use strict";
const { DataTypes } = require("sequelize");
const sequelize = require("../../database/database");

const DetalleGuia = sequelize.define(
  "DetalleGuia",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    guia_id: {
      type: DataTypes.INTEGER,
      references: { model: "GuiaRemision", key: "id" },
    },
    item: DataTypes.INTEGER,
    descripcion: DataTypes.STRING(500),
    cantidad: DataTypes.DECIMAL(15, 6),
    unidad_id: {
      type: DataTypes.CHAR(3),
      references: { model: "Unidad", key: "id" },
    },
    numero_serie: DataTypes.STRING(50),
    codigo_sunat: DataTypes.STRING(12),
  },
  { tableName: "DetalleGuia", timestamps: false }
);

module.exports = DetalleGuia;
