const { DataTypes } = require("sequelize");
const sequelize = require("../../database");

const Cuota = sequelize.define(
  "Cuota",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    comprobante_id: {
      type: DataTypes.INTEGER,
      references: {
        model: "Comprobante",
        key: "id",
      },
    },
    numero: DataTypes.STRING(3),
    importe: DataTypes.DECIMAL(15, 6),
    fecha_vencimiento: DataTypes.DATE,
    estado: DataTypes.CHAR(1),
  },
  {
    tableName: "Cuota",
    timestamps: false,
  }
);

module.exports = Cuota;
