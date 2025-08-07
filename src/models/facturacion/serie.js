const { DataTypes } = require("sequelize");
const sequelize = require("../../database/database");

const Serie = sequelize.define(
  "Serie",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tipo_comprobante_id: {
      type: DataTypes.CHAR(2),
      references: {
        model: "TipoComprobante",
        key: "id",
      },
    },
    serie: DataTypes.STRING(4),
    correlativo: DataTypes.INTEGER,
  },
  {
    tableName: "Serie",
    timestamps: false,
  }
);

module.exports = Serie;
