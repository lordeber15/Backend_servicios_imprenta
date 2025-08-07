const Cliente = require("./Cliente");
const Comprobante = require("./Comprobante");
const Cuota = require("./Cuota");
const Detalle = require("./Detalle");
const Emisor = require("./Emisor");
const EnvioResumen = require("./EnvioResumen");
const EnvioResumenDetalle = require("./EnvioResumenDetalle");
const Moneda = require("./Moneda");
const Producto = require("./Producto");
const Serie = require("./Serie");
const TablaParametrica = require("./TablaParametrica");
const TipoAfectacion = require("./TipoAfectacion");
const TipoComprobante = require("./TipoComprobante");
const TipoDocumento = require("./TipoDocumento");
const Unidad = require("./unidad");

// Relacionar las tablas entre sí
Emisor.hasMany(Comprobante, { foreignKey: "emisor_id" });
Comprobante.belongsTo(Emisor, { foreignKey: "emisor_id" });

Cliente.hasMany(Comprobante, { foreignKey: "cliente_id" });
Comprobante.belongsTo(Cliente, { foreignKey: "cliente_id" });

TipoComprobante.hasMany(Comprobante, { foreignKey: "tipo_comprobante_id" });
Comprobante.belongsTo(TipoComprobante, { foreignKey: "tipo_comprobante_id" });

Moneda.hasMany(Comprobante, { foreignKey: "moneda_id" });
Comprobante.belongsTo(Moneda, { foreignKey: "moneda_id" });

Producto.hasMany(Detalle, { foreignKey: "producto_id" });
Detalle.belongsTo(Producto, { foreignKey: "producto_id" });

Comprobante.hasMany(Detalle, { foreignKey: "comprobante_id" });
Detalle.belongsTo(Comprobante, { foreignKey: "comprobante_id" });

Serie.hasMany(Comprobante, { foreignKey: "serie_id" });
Comprobante.belongsTo(Serie, { foreignKey: "serie_id" });

EnvioResumen.hasMany(EnvioResumenDetalle, { foreignKey: "envio_id" });
EnvioResumenDetalle.belongsTo(EnvioResumen, { foreignKey: "envio_id" });

Comprobante.hasMany(EnvioResumenDetalle, { foreignKey: "comprobante_id" });
EnvioResumenDetalle.belongsTo(Comprobante, { foreignKey: "comprobante_id" });

TipoAfectacion.hasMany(Producto, { foreignKey: "tipo_afectacion_id" });
Producto.belongsTo(TipoAfectacion, { foreignKey: "tipo_afectacion_id" });

Unidad.hasMany(Producto, { foreignKey: "unidad_id" });
Producto.belongsTo(Unidad, { foreignKey: "unidad_id" });

TipoDocumento.hasMany(Cliente, { foreignKey: "tipo_documento_id" });
Cliente.belongsTo(TipoDocumento, { foreignKey: "tipo_documento_id" });

TablaParametrica.hasMany(EnvioResumen, { foreignKey: "tipo" });
EnvioResumen.belongsTo(TablaParametrica, { foreignKey: "tipo" });
