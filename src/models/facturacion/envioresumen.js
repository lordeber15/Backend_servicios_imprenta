const { DataTypes } = require("sequelize");
const sequelize = require("../../database/database");

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
    // Campos adicionales para gestión SUNAT
    emisor_id: {
      type: DataTypes.INTEGER,
      references: { model: "Emisor", key: "id" },
    },
    // RC=Resumen Diario, RA=Comunicación de Baja
    tipo: DataTypes.CHAR(2),
    // PE=Pendiente consulta, PR=Procesado, ER=Error
    estado_ticket: { type: DataTypes.CHAR(2), defaultValue: "PE" },
    xml_firmado: DataTypes.TEXT,
  },
  {
    tableName: "EnvioResumen",
    timestamps: false,
  }
);

module.exports = EnvioResumen;
