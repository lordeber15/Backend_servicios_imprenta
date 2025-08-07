const { DataTypes } = require("sequelize");
const sequelize = require("../database/database");

const Comprobante = sequelize.define(
  "Comprobante",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    emisor_id: {
      type: DataTypes.INTEGER,
      references: {
        model: "Emisor",
        key: "id",
      },
    },
    tipo_comprobante_id: {
      type: DataTypes.CHAR(2),
      references: {
        model: "TipoComprobante",
        key: "id",
      },
    },
    serie_id: {
      type: DataTypes.INTEGER,
      references: {
        model: "Serie",
        key: "id",
      },
    },
    serie: DataTypes.STRING(4),
    correlativo: DataTypes.INTEGER,
    forma_pago: DataTypes.STRING(50),
    fecha_emision: DataTypes.DATE,
    fecha_vencimiento: DataTypes.DATE,
    moneda_id: {
      type: DataTypes.CHAR(3),
      references: {
        model: "Moneda",
        key: "id",
      },
    },
    op_gravadas: DataTypes.DECIMAL(11, 2),
    op_exoneradas: DataTypes.DECIMAL(11, 2),
    op_inafectas: DataTypes.DECIMAL(11, 2),
    igv: DataTypes.DECIMAL(11, 2),
    total: DataTypes.DECIMAL(11, 2),
    cliente_id: {
      type: DataTypes.INTEGER,
      references: {
        model: "Cliente",
        key: "id",
      },
    },
  },
  {
    tableName: "comprobante",
    timestamps: false,
  }
);

module.exports = Comprobante;
