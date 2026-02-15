const { DataTypes } = require("sequelize");
const sequelize = require("../../database");

const TipoAfectacion = sequelize.define(
  "TipoAfectacion",
  {
    id: {
      type: DataTypes.CHAR(2),
      primaryKey: true,
    },
    descripcion: DataTypes.STRING(50),
    letra: DataTypes.CHAR(1),
    codigo: DataTypes.CHAR(4),
    nombre: DataTypes.CHAR(3),
    tipo: DataTypes.CHAR(3),
  },
  {
    tableName: "TipoAfectacion",
    timestamps: false,
  }
);

module.exports = TipoAfectacion;
