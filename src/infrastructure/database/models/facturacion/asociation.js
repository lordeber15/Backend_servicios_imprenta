/**
 * ARCHIVO DE ASOCIACIONES (MODEL RELATIONS)
 * 
 * Este archivo centraliza todas las relaciones (One-to-Many, Many-to-One, etc.)
 * entre los modelos de la base de datos. Es clave para el funcionamiento de 
 * Sequelize y la integridad referencial.
 */
const Cliente = require("./cliente");
const Comprobante = require("./comprobante");
const Cuota = require("./cuota");
const Detalle = require("./detalles");
const Emisor = require("./emisor");
const EnvioResumen = require("./envioresumen");
const EnvioResumenDetalle = require("./envioresumendetalle");
const Moneda = require("./moneda");
const Producto = require("./producto");
const Serie = require("./serie");
const TablaParametrica = require("./tablaparametrica");
const TipoAfectacion = require("./tipoafectacion");
const TipoComprobante = require("./tipocomprobante");
const TipoDocumento = require("./tipodocumento");
const Unidad = require("./unidad");
const GuiaRemision = require("./guiaremision");
const DetalleGuia = require("./detalleguia");
const ComunicacionBaja = require("./comunicacionbaja");
const ComunicacionBajaDetalle = require("./comunicacionbajadetalle");

// RELACIONES DE FACTURACIÓN CORE
// --------------------------------------------------------------------------

// Emisor <-> Comprobante
Emisor.hasMany(Comprobante, { foreignKey: "emisor_id" });
Comprobante.belongsTo(Emisor, { foreignKey: "emisor_id" });

// Cliente <-> Comprobante
Cliente.hasMany(Comprobante, { foreignKey: "cliente_id" });
Comprobante.belongsTo(Cliente, { foreignKey: "cliente_id" });

// TipoComprobante <-> Comprobante (Boleta, Factura, etc.)
TipoComprobante.hasMany(Comprobante, { foreignKey: "tipo_comprobante_id" });
Comprobante.belongsTo(TipoComprobante, { foreignKey: "tipo_comprobante_id" });

// Moneda <-> Comprobante
Moneda.hasMany(Comprobante, { foreignKey: "moneda_id" });
Comprobante.belongsTo(Moneda, { foreignKey: "moneda_id" });

// Serie <-> Comprobante
Serie.hasMany(Comprobante, { foreignKey: "serie_id" });
Comprobante.belongsTo(Serie, { foreignKey: "serie_id" });

// RELACIONES DE DETALLES E INVENTARIO
// --------------------------------------------------------------------------

// Producto <-> Detalle de Comprobante
Producto.hasMany(Detalle, { foreignKey: "producto_id" });
Detalle.belongsTo(Producto, { foreignKey: "producto_id" });

// Comprobante <-> Detalle
Comprobante.hasMany(Detalle, { foreignKey: "comprobante_id" });
Detalle.belongsTo(Comprobante, { foreignKey: "comprobante_id" });

// Comprobante <-> Cuota (cuotas de pago a crédito)
Comprobante.hasMany(Cuota, { foreignKey: "comprobante_id" });
Cuota.belongsTo(Comprobante, { foreignKey: "comprobante_id" });

// TipoAfectacion <-> Producto (IGV)
TipoAfectacion.hasMany(Producto, { foreignKey: "tipo_afectacion_id" });
Producto.belongsTo(TipoAfectacion, { foreignKey: "tipo_afectacion_id" });

// Unidad <-> Producto
Unidad.hasMany(Producto, { foreignKey: "unidad_id" });
Producto.belongsTo(Unidad, { foreignKey: "unidad_id" });

// RELACIONES DE INTEGRACIÓN SUNAT (RESÚMENES Y BAJAS)
// --------------------------------------------------------------------------

// Resumen Diario <-> Detalle
EnvioResumen.hasMany(EnvioResumenDetalle, { foreignKey: "envio_id" });
EnvioResumenDetalle.belongsTo(EnvioResumen, { foreignKey: "envio_id" });

// Comprobante <-> Resumen Diario
Comprobante.hasMany(EnvioResumenDetalle, { foreignKey: "comprobante_id" });
EnvioResumenDetalle.belongsTo(Comprobante, { foreignKey: "comprobante_id" });

// Tipo de documento <-> Cliente
TipoDocumento.hasMany(Cliente, { foreignKey: "tipo_documento_id" });
Cliente.belongsTo(TipoDocumento, { foreignKey: "tipo_documento_id" });

// Tabla Paramétrica <-> EnvioResumen
TablaParametrica.hasMany(EnvioResumen, { foreignKey: "tipo" });
EnvioResumen.belongsTo(TablaParametrica, { foreignKey: "tipo" });

// EnvioResumen <-> Emisor
Emisor.hasMany(EnvioResumen, { foreignKey: "emisor_id" });
EnvioResumen.belongsTo(Emisor, { foreignKey: "emisor_id" });

// RELACIONES DE GUÍA DE REMISIÓN
// --------------------------------------------------------------------------

// Emisor <-> Guía
Emisor.hasMany(GuiaRemision, { foreignKey: "emisor_id" });
GuiaRemision.belongsTo(Emisor, { foreignKey: "emisor_id" });

// Cliente (Destinatario) <-> Guía
Cliente.hasMany(GuiaRemision, { foreignKey: "destinatario_id", as: "GuiasComoDestinatario" });
GuiaRemision.belongsTo(Cliente, { foreignKey: "destinatario_id", as: "Destinatario" });

// Comprobante <-> Guía
Comprobante.hasMany(GuiaRemision, { foreignKey: "comprobante_rel_id", as: "GuiasRelacionadas" });
GuiaRemision.belongsTo(Comprobante, { foreignKey: "comprobante_rel_id", as: "ComprobanteRelacionado" });

// Guía <-> Detalle de Guía
GuiaRemision.hasMany(DetalleGuia, { foreignKey: "guia_id" });
DetalleGuia.belongsTo(GuiaRemision, { foreignKey: "guia_id" });

// Unidad <-> Detalle de Guía
Unidad.hasMany(DetalleGuia, { foreignKey: "unidad_id" });
DetalleGuia.belongsTo(Unidad, { foreignKey: "unidad_id" });

// RELACIONES DE ANULACIONES (BAJAS) Y NOTAS
// --------------------------------------------------------------------------

// Emisor <-> Comunicación de Baja
Emisor.hasMany(ComunicacionBaja, { foreignKey: "emisor_id" });
ComunicacionBaja.belongsTo(Emisor, { foreignKey: "emisor_id" });

// Comunicación de Baja <-> Detalle
ComunicacionBaja.hasMany(ComunicacionBajaDetalle, { foreignKey: "baja_id" });
ComunicacionBajaDetalle.belongsTo(ComunicacionBaja, { foreignKey: "baja_id" });

// Comprobante <-> Comunicación de Baja
Comprobante.hasMany(ComunicacionBajaDetalle, { foreignKey: "comprobante_id", as: "BajasDetalle" });
ComunicacionBajaDetalle.belongsTo(Comprobante, { foreignKey: "comprobante_id" });

// Auto-referencia para Notas de Crédito (07) y Débito (08)
// Relaciona una nota con su comprobante original de referencia
Comprobante.hasMany(Comprobante, { foreignKey: "comprobante_ref_id", as: "NotasAsociadas" });
Comprobante.belongsTo(Comprobante, { foreignKey: "comprobante_ref_id", as: "comprobanteRef" });
