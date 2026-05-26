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
    // Estados: GENERADO → FIRMADO → ENVIANDO → ACEPTADO | OBSERVADO | RECHAZADO | ERROR_RED | FUERA_PLAZO | SIN_CDR
    estado_sunat: {
      type: DataTypes.STRING(15),
      defaultValue: "GENERADO",
      validate: {
        isIn: [["GENERADO","FIRMADO","ENVIANDO","ACEPTADO","OBSERVADO",
                 "RECHAZADO","ERROR_RED","FUERA_PLAZO","SIN_CDR"]],
      },
    },
    // Campos canónicos CDR
    cdr_code:   { type: DataTypes.STRING(10),  allowNull: true }, // Código numérico del CDR
    cdr_xml:    { type: DataTypes.TEXT,         allowNull: true }, // XML del CDR en base64
    xml_path:   { type: DataTypes.TEXT,         allowNull: true }, // Ruta relativa del XML firmado
    hash:       { type: DataTypes.STRING(255),  allowNull: true }, // DigestValue del XML firmado
    enviado_at: { type: DataTypes.DATE,         allowNull: true }, // Timestamp exacto del envío
    // Campos legacy (mantenidos por compatibilidad)
    codigo_sunat:      DataTypes.STRING(10),
    mensaje_sunat:     DataTypes.STRING(500),
    hash_cpe:          DataTypes.STRING(255),
    nombre_xml:        DataTypes.STRING(60),
    fecha_envio_sunat: DataTypes.DATE,
    intentos_envio: { type: DataTypes.INTEGER, defaultValue: 0 },
    es_terminal: { type: DataTypes.BOOLEAN, defaultValue: false }, // true = SUNAT rechazó por datos, no reenviar sin corregir XML
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
    metodo_pago: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    tableName: "Comprobante",
    timestamps: false,
  }
);

module.exports = Comprobante;
