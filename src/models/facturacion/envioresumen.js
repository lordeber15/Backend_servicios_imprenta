const { DataTypes } = require("sequelize");
const sequelize = require("../database/database");

const EnvioResumen = sequelize.define(
  "EnvioResumen",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fecha_envio: DataTypes.DATE,
    fecha_referencia: DataTypes.DATE,
    correlativo: DataTypes.INTEGER,
    resumen: DataTypes.SMALLINT,
    baja: DataTypes.SMALLINT,
    nombrexml: DataTypes.STRING(50),
    mensaje_sunat: DataTypes.STRING(200),
    codigo_sunat: DataTypes.STRING(20),
    ticket: DataTypes.STRING(50),
    estado: DataTypes.CHAR(1),
  },
  {
    tableName: "envio_resumen",
    timestamps: false,
  }
);

module.exports = EnvioResumen;
