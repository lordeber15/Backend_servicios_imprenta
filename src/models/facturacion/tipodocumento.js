const { DataTypes } = require("sequelize");
const sequelize = require("../database/database");

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
    tableName: "tipo_documento",
    timestamps: false,
  }
);

module.exports = TipoDocumento;
