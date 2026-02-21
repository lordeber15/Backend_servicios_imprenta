const { DataTypes } = require("sequelize");
const sequelize = require("../../database");

const AperturaCaja = sequelize.define("AperturaCaja", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  fecha_apertura: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  hora_apertura: {
    type: DataTypes.STRING(8),
    allowNull: true,
  },
  monto_apertura: {
    type: DataTypes.DECIMAL(11, 2),
    allowNull: false,
  },
  estado: {
    type: DataTypes.ENUM("abierta", "cerrada"),
    defaultValue: "abierta",
    allowNull: false,
  },
  total_ventas: {
    type: DataTypes.DECIMAL(11, 2),
    allowNull: true,
  },
  monto_cierre_fisico: {
    type: DataTypes.DECIMAL(11, 2),
    allowNull: true,
  },
  diferencia: {
    type: DataTypes.DECIMAL(11, 2),
    allowNull: true,
  },
  observacion: {
    type: DataTypes.STRING(250),
    allowNull: true,
  },
});

module.exports = AperturaCaja;
