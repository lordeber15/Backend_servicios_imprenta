const { DataTypes } = require("sequelize");
const sequelize = require("../../database");

const TipoDocumento = sequelize.define(
  "TipoDocumento",
  {
    id: {
      type: DataTypes.CHAR(1),
      primaryKey: true,
    },
    descripcion: DataTypes.STRING(50),
  },
  {
    tableName: "TipoDocumento",
    timestamps: false,
  }
);

module.exports = TipoDocumento;
