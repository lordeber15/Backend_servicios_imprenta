const { DataTypes } = require("sequelize");
const sequelize = require("../database/database");

const Cliente = sequelize.define(
  "Cliente",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tipo_documento_id: {
      type: DataTypes.CHAR(1),
      references: {
        model: "TipoDocumento",
        key: "id",
      },
    },
    nrodoc: DataTypes.STRING(15),
    razon_social: DataTypes.STRING(100),
    direccion: DataTypes.STRING(100),
  },
  {
    tableName: "cliente",
    timestamps: false,
  }
);

module.exports = Cliente;
