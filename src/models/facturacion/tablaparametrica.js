const { DataTypes } = require("sequelize");
const sequelize = require("../database/database");

const TablaParametrica = sequelize.define(
  "TablaParametrica",
  {
    tipo: {
      type: DataTypes.CHAR(1),
      primaryKey: true,
    },
    codigo: {
      type: DataTypes.STRING(5),
      primaryKey: true,
    },
    descripcion: DataTypes.STRING(200),
  },
  {
    tableName: "tabla_parametrica",
    timestamps: false,
  }
);

module.exports = TablaParametrica;
