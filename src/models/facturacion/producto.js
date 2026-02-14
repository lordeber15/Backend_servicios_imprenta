/**
 * MODELO PRODUCTO
 * 
 * Este modelo representa la tabla 'Producto' en la base de datos.
 * Se utiliza para gestionar el catálogo de productos/servicios que se facturan,
 * incluyendo información necesaria para la integración con SUNAT.
 * 
 * Atributos:
 * - nombre: Descripción o nombre del producto.
 * - valor_unitario: Precio sin impuestos.
 * - tipo_afectacion_id: Código SUNAT para el tipo de IGV (Ej: 10 para Gravado - Operación Onerosa).
 * - unidad_id: Código SUNAT para la unidad de medida (Ej: NIU para Unidades).
 * - codigo_sunat: Código del catálogo de productos de SUNAT (opcional).
 * - afecto_icbper: Indica si está afecto al impuesto a las bolsas plásticas.
 * - factor_icbper: Monto fijo del impuesto ICBPER.
 */
const { DataTypes } = require("sequelize");
const sequelize = require("../../database/database");

const Producto = sequelize.define(
  "Producto",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: DataTypes.STRING(255),
    valor_unitario: DataTypes.DECIMAL(15, 6),
    tipo_afectacion_id: {
      type: DataTypes.CHAR(2),
      references: {
        model: "TipoAfectacion", // Referencia a la tabla de tipos de afectación
        key: "id",
      },
    },
    unidad_id: {
      type: DataTypes.CHAR(3),
      references: {
        model: "Unidad", // Referencia a la tabla de unidades de medida
        key: "id",
      },
    },
    codigo_sunat: DataTypes.STRING(12),
    afecto_icbper: DataTypes.SMALLINT,
    factor_icbper: DataTypes.DECIMAL(15, 2),
    stock: { type: DataTypes.INTEGER, defaultValue: 0 },
    es_servicio: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    tableName: "Producto",
    timestamps: false, // Esta tabla no usa columnas createdAt/updatedAt
  }
);

module.exports = Producto;
