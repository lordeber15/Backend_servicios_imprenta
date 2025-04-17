const { DataTypes } = require("sequelize");
const sequelize = require("../database/database");

const Servicios = sequelize.define("servicios", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  cantidad: {
    type: DataTypes.DECIMAL,
    allowNull: false,
  },
  descripcion: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  estado: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  total: {
    type: DataTypes.DECIMAL,
    allowNull: false,
  },
  acuenta: {
    type: DataTypes.DECIMAL,
    allowNull: false,
  },
});

module.exports = { Servicios };
