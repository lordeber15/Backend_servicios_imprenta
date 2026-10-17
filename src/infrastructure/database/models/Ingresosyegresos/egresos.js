const { DataTypes } = require("sequelize");
const sequelize = require("../../database");

const Egreso = sequelize.define("egreso", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  monto: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  descripcion: {
    type: DataTypes.STRING,
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  caja_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: "AperturaCajas", key: "id" }, // caja abierta al registrar el movimiento
  },
  metodo: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

module.exports = { Egreso };
