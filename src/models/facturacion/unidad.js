const { DataTypes } = require("sequelize");
const sequelize = require("../../database/database");

const Unidad = sequelize.define(
  "Unidad",
  {
    id: {
      type: DataTypes.CHAR(3),
      primaryKey: true,
    },
    descripcion: DataTypes.STRING(50),
  },
  {
    tableName: "Unidad",
    timestamps: false,
  }
);

module.exports = Unidad;
