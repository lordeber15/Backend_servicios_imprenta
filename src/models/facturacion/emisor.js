const { DataTypes } = require("sequelize");
const sequelize = require("../database/database");

const Emisor = sequelize.define(
  "Emisor",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tipodoc: DataTypes.CHAR(1),
    ruc: DataTypes.CHAR(11),
    razon_social: DataTypes.STRING(100),
    nombre_comercial: DataTypes.STRING(100),
    direccion: DataTypes.STRING(100),
    pais: DataTypes.STRING(100),
    departamento: DataTypes.STRING(100),
    provincia: DataTypes.STRING(100),
    distrito: DataTypes.STRING(100),
    ubigeo: DataTypes.CHAR(6),
    usuario_sol: DataTypes.STRING(20),
    clave_sol: DataTypes.STRING(20),
  },
  {
    tableName: "emisor",
    timestamps: false,
  }
);

module.exports = Emisor;
