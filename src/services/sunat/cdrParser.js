/**
 * PARSER DE CDR (CONSTANCIA DE RECEPCIÓN)
 * 
 * Este módulo se encarga de descomprimir el archivo ZIP retornado por SUNAT,
 * extraer el XML (ApplicationResponse) y parsear los códigos de respuesta
 * y mensajes de aceptación o rechazo.
 * 
 * @module services/sunat/cdrParser
 */
const AdmZip = require("adm-zip");
const { DOMParser } = require("@xmldom/xmldom");

/**
 * Parsea la respuesta CDR de SUNAT.
 * El CDR es un ZIP base64 que contiene un archivo XML: R-{nombreOriginal}.xml
 * Ese XML es un ApplicationResponse UBL 2.1 con el resultado de la validación.
 *
 * @param {string} cdrBase64  Respuesta de SUNAT en base64 (applicationResponse)
 * @returns {{
 *   responseCode: string,   "0" = aceptado, otro = rechazado/con obs
 *   description: string,    Descripción del resultado
 *   notes: string[],        Observaciones (puede estar vacío)
 *   digestValue: string,    Hash del comprobante para el QR
 *   xmlContent: string,     XML del CDR como texto
 *   accepted: boolean       true si responseCode === "0" o código de obs 2000-2999
 * }}
 */
function parseCdr(cdrBase64) {
  if (!cdrBase64) throw new Error("CDR vacío o nulo");

  const zipBuffer = Buffer.from(cdrBase64, "base64");
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  if (!entries.length) {
    throw new Error("ZIP del CDR no contiene archivos");
  }

  const xmlContent = entries[0].getData().toString("utf8");
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, "text/xml");

  const getTagText = (tagName) => {
    const elements = doc.getElementsByTagNameNS("*", tagName);
    if (elements && elements.length > 0) {
      return elements.item(0).textContent.trim();
    }
    return null;
  };

  const responseCode = getTagText("ResponseCode") || "";
  const description = getTagText("Description") || "";

  // Puede haber múltiples <cbc:Note> con observaciones
  const noteElements = doc.getElementsByTagNameNS("*", "Note");
  const notes = [];
  for (let i = 0; i < noteElements.length; i++) {
    const note = noteElements.item(i).textContent.trim();
    if (note) notes.push(note);
  }

  // Hash del CPE (DigestValue del ApplicationResponse)
  const digestValue = getTagText("DigestValue") || "";

  // responseCode "0" = aceptado sin observaciones
  // responseCode "2000"-"3999" = aceptado con observaciones (warning)
  // responseCode "1xxx" o SOAP fault = rechazado
  const code = parseInt(responseCode, 10);
  const accepted = responseCode === "0" || (code >= 2000 && code <= 3999);

  return {
    responseCode,
    description,
    notes,
    digestValue,
    xmlContent,
    accepted,
  };
}

module.exports = { parseCdr };
