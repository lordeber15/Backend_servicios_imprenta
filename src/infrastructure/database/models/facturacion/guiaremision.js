"use strict";
const { DataTypes } = require("sequelize");
const sequelize = require("../../database");

const GuiaRemision = sequelize.define(
  "GuiaRemision",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    emisor_id: {
      type: DataTypes.INTEGER,
      references: { model: "Emisor", key: "id" },
    },
    // "09" = Guía Remitente, "31" = Guía Transportista
    tipo_guia: DataTypes.CHAR(2),
    serie: DataTypes.STRING(4),
    correlativo: DataTypes.INTEGER,
    fecha_emision: DataTypes.DATEONLY,
    fecha_traslado: DataTypes.DATEONLY,

    // Datos del traslado (catálogo 20 SUNAT)
    // 01=Venta, 02=Compra, 03=Traslado entre establecimientos, etc.
    motivo_traslado_id: DataTypes.STRING(2),
    descripcion_motivo: DataTypes.STRING(250),
    indicador_transborde: { type: DataTypes.BOOLEAN, defaultValue: false },
    peso_bruto_total: DataTypes.DECIMAL(12, 3),
    unidad_peso_id: DataTypes.CHAR(3), // KGM, TNE
    numero_bultos: DataTypes.INTEGER,
    numero_contenedor: DataTypes.STRING(20),
    codigo_puerto: DataTypes.STRING(10),

    // "01"=transporte público, "02"=privado
    modalidad_traslado: DataTypes.CHAR(2),

    // Transportista (modalidad pública)
    transportista_ruc: DataTypes.CHAR(11),
    transportista_razon_social: DataTypes.STRING(100),
    mtc_numero: DataTypes.STRING(20),

    // Conductor
    conductor_nrodoc: DataTypes.STRING(15),
    conductor_tipo_doc: DataTypes.CHAR(1),
    conductor_nombres: DataTypes.STRING(100),
    conductor_licencia: DataTypes.STRING(20),

    // Vehículo
    vehiculo_placa: DataTypes.STRING(10),

    // Destinatario
    destinatario_id: {
      type: DataTypes.INTEGER,
      references: { model: "Cliente", key: "id" },
      allowNull: true,
    },

    // Direcciones de partida y llegada
    ubigeo_partida: DataTypes.CHAR(6),
    direccion_partida: DataTypes.STRING(200),
    ubigeo_llegada: DataTypes.CHAR(6),
    direccion_llegada: DataTypes.STRING(200),

    // Comprobante de venta relacionado (opcional)
    comprobante_rel_id: {
      type: DataTypes.INTEGER,
      references: { model: "Comprobante", key: "id" },
      allowNull: true,
    },

    // Estado SUNAT
    estado_sunat: { type: DataTypes.CHAR(2), defaultValue: "PE" },
    codigo_sunat: DataTypes.STRING(10),
    mensaje_sunat: DataTypes.STRING(500),
    hash_cpe: DataTypes.STRING(255),
    nombre_xml: DataTypes.STRING(60),
    fecha_envio_sunat: DataTypes.DATE,
    intentos_envio: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  { tableName: "GuiaRemision", timestamps: false }
);

module.exports = GuiaRemision;
