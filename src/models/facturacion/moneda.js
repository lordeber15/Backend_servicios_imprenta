const { DataTypes } = require("sequelize");
const sequelize = require("../../database/database");

const Moneda = sequelize.define(
  "Moneda",
  {
    id: {
      type: DataTypes.CHAR(3),
      primaryKey: true,
    },
    descripcion: DataTypes.STRING(50),
  },
  {
    tableName: "Moneda",
    timestamps: false,
  }
);

module.exports = Moneda;
