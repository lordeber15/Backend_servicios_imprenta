/**
 * MODELO COMPROBANTE
 * 
 * Almacena la cabecera de los documentos electrónicos (Facturas, Boletas, Notas).
 * Contiene tanto los datos comerciales (totales, fechas) como los datos de control
 * retornados por SUNAT (estado, hash, mensaje).
 */
const { DataTypes } = require("sequelize");
const sequelize = require("../../database");

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
      type: DataTypes.CHAR(2), // 01=Factura, 03=Boleta, 07=NC, 08=ND
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
    serie: DataTypes.STRING(4), // Ej: F001, B001
    correlativo: DataTypes.INTEGER,
    forma_pago: DataTypes.STRING(50), // Contado o Crédito
    fecha_emision: DataTypes.DATE,
    fecha_vencimiento: DataTypes.DATE,
    moneda_id: {
      type: DataTypes.CHAR(3), // PEN, USD
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
    // ── CAMPOS DE INTEGRACIÓN SUNAT ──────────────────────────────────────────
    // PE=Pendiente, EN=En proceso, AC=Aceptado, RR=Rechazado, AN=Anulado
    estado_sunat: { type: DataTypes.CHAR(2), defaultValue: "PE" },
    codigo_sunat: DataTypes.STRING(10), // Código de respuesta del CDR
    mensaje_sunat: DataTypes.STRING(500), // Descripción del error o aceptación
    // Hash del comprobante (DigestValue) retornado por SUNAT tras la firma
    hash_cpe: DataTypes.STRING(255),
    // Nombre exacto del archivo: {RUC}-{tipo}-{SERIE}-{CORRELATIVO}
    nombre_xml: DataTypes.STRING(60),
    fecha_envio_sunat: DataTypes.DATE,
    intentos_envio: { type: DataTypes.INTEGER, defaultValue: 0 },
    // Para Notas de Crédito y Débito
    tipo_nota_id: DataTypes.STRING(4),
    descripcion_nota: DataTypes.STRING(250),
    comprobante_ref_id: {
      type: DataTypes.INTEGER,
      references: { model: "Comprobante", key: "id" },
      allowNull: true,
    },
    op_gratuitas: DataTypes.DECIMAL(11, 2),
    icbper: DataTypes.DECIMAL(11, 2),
  },
  {
    tableName: "Comprobante",
    timestamps: false,
  }
);

module.exports = Comprobante;
