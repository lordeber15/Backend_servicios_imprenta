"use strict";
const { build: buildFactura } = require("./facturaBuilder");

/**
 * Genera el XML UBL 2.1 para Boleta de Venta Electrónica (tipo 03).
 * La estructura es idéntica a la Factura; solo cambia el valor del
 * InvoiceTypeCode ("01" → "03"). El listID (tipo de operación,
 * catálogo 51 SUNAT) se mantiene en "0101" = Venta interna: la forma
 * de pago contado/crédito viaja en cac:PaymentTerms, no en el listID.
 *
 * @param {object} comprobante  Instancia Comprobante con relaciones cargadas
 * @returns {string}  XML sin firma
 */
function build(comprobante) {
  // Reusamos el builder de factura y reemplazamos el tipo de documento
  let xml = buildFactura(comprobante);

  // Reemplazar el InvoiceTypeCode: para boleta el valor es "03"
  xml = xml.replace(
    /(<cbc:InvoiceTypeCode[^>]*>)01(<\/cbc:InvoiceTypeCode>)/,
    (_m, open, close) => open + "03" + close
  );

  return xml;
}

module.exports = { build };
