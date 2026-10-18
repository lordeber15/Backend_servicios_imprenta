const { DataTypes } = require("sequelize");
const sequelize = require("../../database");

/**
 * Credenciales SUNAT cifradas de un emisor (migración 0006).
 *
 * A propósito NO tiene asociaciones: ningún include de Emisor/Comprobante
 * puede traerla. Solo se lee a través de application/services/credenciales.service.js.
 */
const EmisorCredencial = sequelize.define("EmisorCredencial", {
  emisor_id: { type: DataTypes.INTEGER, primaryKey: true },
  clave_sol_cifrada: { type: DataTypes.TEXT, allowNull: true },
  client_secret_cifrado: { type: DataTypes.TEXT, allowNull: true },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: "EmisorCredenciales",
  timestamps: false,
});

module.exports = EmisorCredencial;
