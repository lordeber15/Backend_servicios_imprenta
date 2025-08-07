const { DataTypes } = require("sequelize");
const sequelize = require("../../database/database");

const Detalle = sequelize.define(
  "Detalle",
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
    item: DataTypes.INTEGER,
    producto_id: {
      type: DataTypes.INTEGER,
      references: {
        model: "Producto",
        key: "id",
      },
    },
    cantidad: DataTypes.DECIMAL(15, 6),
    valor_unitario: DataTypes.DECIMAL(15, 6),
    precio_unitario: DataTypes.DECIMAL(15, 6),
    igv: DataTypes.DECIMAL(15, 6),
    porcentaje_igv: DataTypes.DECIMAL(15, 6),
    valor_total: DataTypes.DECIMAL(15, 6),
    importe_total: DataTypes.DECIMAL(15, 6),
  },
  {
    tableName: "Detalle",
    timestamps: false,
  }
);

module.exports = Detalle;
