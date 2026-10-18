"use strict";
/**
 * GENERACIÓN Y FIRMA DEL XML DE UN COMPROBANTE
 *
 * Compartido por la emisión (emision.service) y el reenvío (sunat.controller):
 * ambos regeneran el XML desde la BD con los builders actuales.
 */
const Comprobante    = require("../../infrastructure/database/models/facturacion/comprobante");
const Emisor         = require("../../infrastructure/database/models/facturacion/emisor");
const Cliente        = require("../../infrastructure/database/models/facturacion/cliente");
const TipoDocumento  = require("../../infrastructure/database/models/facturacion/tipodocumento");
const Detalle        = require("../../infrastructure/database/models/facturacion/detalles");
const Producto       = require("../../infrastructure/database/models/facturacion/producto");
const TipoAfectacion = require("../../infrastructure/database/models/facturacion/tipoafectacion");
const Unidad         = require("../../infrastructure/database/models/facturacion/unidad");
const TipoComprobante = require("../../infrastructure/database/models/facturacion/tipocomprobante");
const Moneda         = require("../../infrastructure/database/models/facturacion/moneda");
const Serie          = require("../../infrastructure/database/models/facturacion/serie");
const Cuota          = require("../../infrastructure/database/models/facturacion/cuota");
require("../../infrastructure/database/models/facturacion/asociation");

const facturaBuilder = require("../../infrastructure/external_services/sunat/xmlBuilders/facturaBuilder");
const boletaBuilder  = require("../../infrastructure/external_services/sunat/xmlBuilders/boletaBuilder");
const xmlSigner      = require("../../infrastructure/external_services/sunat/xmlSigner");
const storageHelper  = require("../../infrastructure/external_services/sunat/storageHelper");

// Include completo necesario para reconstruir el XML de un comprobante.
const INCLUDE_XML = [
  { model: Emisor },
  { model: Cliente, include: [{ model: TipoDocumento }] },
  { model: Detalle, include: [{ model: Producto, include: [TipoAfectacion, Unidad] }] },
  { model: TipoComprobante },
  { model: Moneda },
  { model: Serie },
  { model: Cuota },
  { model: Comprobante, as: "comprobanteRef" },
];

/**
 * Genera el XML según el tipo de comprobante, lo firma y lo guarda en disco.
 * Usado por emitir y por reenviar (para que el reenvío tome los datos y
 * builders actuales en lugar del XML viejo en disco).
 * @returns {Promise<string>} nombre del archivo XML firmado
 */
const generarYFirmarXml = async (comprobante) => {
  const certPath     = process.env.SUNAT_CERT_PATH;
  const certPassword = process.env.SUNAT_CERT_PASSWORD;
  if (!certPath || !certPassword) {
    throw new Error("Certificado digital no configurado (SUNAT_CERT_PATH / SUNAT_CERT_PASSWORD)");
  }

  const correlativoStr = String(comprobante.correlativo).padStart(8, "0");
  const nombreArchivo  = `${comprobante.Emisor.ruc}-${comprobante.tipo_comprobante_id}-${comprobante.serie}-${correlativoStr}`;

  let xmlSinFirmar;
  if (comprobante.tipo_comprobante_id === "01") {
    xmlSinFirmar = facturaBuilder.build(comprobante);
  } else if (comprobante.tipo_comprobante_id === "03") {
    xmlSinFirmar = boletaBuilder.build(comprobante);
  } else {
    xmlSinFirmar = facturaBuilder.buildNota(comprobante);
  }

  await comprobante.update({
    estado_sunat: "GENERADO",
    es_terminal:  false, // XML nuevo: el resultado anterior ya no aplica
    nombre_xml:   nombreArchivo,
    xml_path:     nombreArchivo,
  });

  let xmlFirmado;
  try {
    xmlFirmado = xmlSigner.signXml(xmlSinFirmar, certPath, certPassword);
  } catch (signErr) {
    throw new Error("Error al firmar el XML: " + signErr.message);
  }

  storageHelper.saveXml(nombreArchivo, xmlFirmado);
  await comprobante.update({ estado_sunat: "FIRMADO" });

  return nombreArchivo;
};

module.exports = { INCLUDE_XML, generarYFirmarXml };
