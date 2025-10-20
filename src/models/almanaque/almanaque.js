const { DataTypes } = require("sequelize");
const sequelize = require("../../database/database");

const Almanaque = sequelize.define("almanaque", {
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
});

module.exports = Almanaque;
