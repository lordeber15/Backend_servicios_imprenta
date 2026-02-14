/**
 * CLIENTE SOAP PARA SUNAT
 * 
 * Este módulo maneja todas las comunicaciones SOAP directas con los Web Services de SUNAT.
 * Soporta envíos síncronos (Facturas, Boletas) y asíncronos (Resúmenes, Bajas).
 * 
 * @module services/sunat/sunatClient
 */

/**
 * Crea un cliente SOAP configurado con seguridad WSSecurity (UsernameToken).
 * 
 * @param {string} wsdlUrl - URL del archivo WSDL de SUNAT.
 * @param {Object} emisor - Datos del emisor (ruc, usuario_sol, clave_sol).
 * @returns {Promise<Object>} Cliente SOAP listo para usar.
 */
async function createClient(wsdlUrl, emisor) {
  const client = await soap.createClientAsync(wsdlUrl, {
    wsdl_options: { timeout: 30000 },
    disableCache: false,
  });

  const username = `${emisor.ruc}${emisor.usuario_sol}`;
  const wsSecurity = new soap.WSSecurity(username, emisor.clave_sol, {
    passwordType: "PasswordText",
    hasTimeStamp: false,
    hasTokenCreated: false,
  });
  client.setSecurity(wsSecurity);
  return client;
}

/**
 * Comprime un XML en un ZIP con el nombre de archivo indicado.
 */
function createZip(nombreArchivoXml, xmlBuffer) {
  const zip = new AdmZip();
  zip.addFile(nombreArchivoXml, xmlBuffer);
  return zip.toBuffer();
}

/**
 * sendBill — Envío SÍNCRONO de un comprobante individual.
 * Usado para: Factura (01), NC (07), ND (08), Boleta individual (03).
 *
 * @param {Buffer} xmlBuffer       XML firmado como Buffer UTF-8
 * @param {string} nombreArchivo   Nombre sin extensión (ej: 20123-01-F001-00000001)
 * @param {object} emisor          Instancia del modelo Emisor (ruc, usuario_sol, clave_sol)
 * @returns {string}  CDR en base64 (ZIP con applicationResponse.xml)
 */
async function sendBill(xmlBuffer, nombreArchivo, emisor) {
  const wsdlUrl = process.env.SUNAT_WS_FACTURAS;
  const client = await createClient(wsdlUrl, emisor);

  const zipBuffer = createZip(nombreArchivo + ".xml", xmlBuffer);

  const [result] = await client.sendBillAsync({
    fileName: nombreArchivo + ".zip",
    contentFile: zipBuffer.toString("base64"),
  });

  // applicationResponse contiene el CDR como base64 de un ZIP
  return result.applicationResponse;
}

/**
 * sendBillGuia — Igual que sendBill pero usa el WS de Guías de Remisión.
 */
async function sendBillGuia(xmlBuffer, nombreArchivo, emisor) {
  const wsdlUrl = process.env.SUNAT_WS_GUIAS;
  const client = await createClient(wsdlUrl, emisor);

  const zipBuffer = createZip(nombreArchivo + ".xml", xmlBuffer);

  const [result] = await client.sendBillAsync({
    fileName: nombreArchivo + ".zip",
    contentFile: zipBuffer.toString("base64"),
  });

  return result.applicationResponse;
}

/**
 * sendSummary — Envío ASÍNCRONO (Resumen Diario RC y Comunicación de Baja RA).
 * Retorna un ticket string que debe consultarse luego con getStatus().
 *
 * @returns {string}  Ticket para consulta posterior
 */
async function sendSummary(xmlBuffer, nombreArchivo, emisor) {
  const wsdlUrl = process.env.SUNAT_WS_RESUMEN;
  const client = await createClient(wsdlUrl, emisor);

  const zipBuffer = createZip(nombreArchivo + ".xml", xmlBuffer);

  const [result] = await client.sendSummaryAsync({
    fileName: nombreArchivo + ".zip",
    contentFile: zipBuffer.toString("base64"),
  });

  return result.ticket;
}

/**
 * getStatus — Consulta el resultado de un envío asíncrono (RC/RA).
 *
 * @returns {{ statusCode: string, content: string|null }}
 *   statusCode: "0"=OK, "98"=En proceso, "99"=Error
 *   content: CDR base64 (solo cuando statusCode = "0")
 */
async function getStatus(ticket, emisor) {
  const wsdlUrl = process.env.SUNAT_WS_RESUMEN;
  const client = await createClient(wsdlUrl, emisor);

  const [result] = await client.getStatusAsync({ ticket });

  return {
    statusCode: result.status.statusCode,
    content: result.status.content || null,
  };
}

module.exports = { sendBill, sendBillGuia, sendSummary, getStatus };
