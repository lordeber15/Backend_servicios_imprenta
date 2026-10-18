const { DataTypes } = require("sequelize");
const sequelize = require("../../database");

const Ticket = sequelize.define("Ticket", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  cliente: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  tipoDocumento: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  numeroDocumento: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  direccion: {
    type: DataTypes.STRING,
  },
  fechaEmision: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  precioTotal: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  // Lo que realmente entró a caja: en servicios es el adelanto, no el total.
  monto_cobrado: {
    type: DataTypes.DECIMAL(11, 2),
    allowNull: true,
  },
  caja_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: "AperturaCajas", key: "id" }, // caja abierta al registrar el movimiento
  },
  metodo_pago: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  monto_recibido: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  vuelto: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
});

module.exports = Ticket;
