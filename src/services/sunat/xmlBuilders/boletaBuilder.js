"use strict";
const { build: buildFactura } = require("./facturaBuilder");

/**
 * Genera el XML UBL 2.1 para Boleta de Venta Electrónica (tipo 03).
 * La estructura es casi idéntica a la Factura; la diferencia principal
 * está en el listID del InvoiceTypeCode ("0101" → "03" no aplica listID,
 * se usa "0" para contado) y que el cliente puede ser anónimo.
 *
 * @param {object} comprobante  Instancia Comprobante con relaciones cargadas
 * @returns {string}  XML sin firma
 */
function build(comprobante) {
  // Reusamos el builder de factura y reemplazamos el tipo de documento
  let xml = buildFactura(comprobante);

  // Reemplazar el InvoiceTypeCode: para boleta es "03" con listID distinto
  xml = xml.replace(
    /(<cbc:InvoiceTypeCode[^>]*>)01(<\/cbc:InvoiceTypeCode>)/,
    (_m, open, close) => {
      // Cambiar listID según SUNAT: 0301 = boleta contado, 0302 = boleta crédito
      const esCredito =
        comprobante.forma_pago &&
        comprobante.forma_pago.toLowerCase().includes("crédit");
      const listId = esCredito ? "0302" : "0301";
      return open
        .replace(/listID="[^"]*"/, `listID="${listId}"`)
        .replace(/listName="[^"]*"/, 'listName="Tipo de Documento"') +
        "03" +
        close;
    }
  );

  return xml;
}

module.exports = { build };
