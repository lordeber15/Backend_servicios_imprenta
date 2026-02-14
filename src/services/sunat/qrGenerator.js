/**
 * GENERADOR DE CÓDIGOS QR
 * 
 * Este módulo produce el código QR obligatorio para los comprobantes electrónicos
 * en formato de datos pipe-delimited (|), tal como lo exige SUNAT.
 * 
 * @module services/sunat/qrGenerator
 */
const QRCode = require("qrcode");

/**
 * Genera un código QR en formato base64 (data URL PNG) con el contenido
 * exigido por SUNAT para la representación impresa del comprobante.
 *
 * Formato SUNAT:
 * {RUC}|{tipo}|{serie}|{correlativo_8dig}|{igv}|{total}|{fecha}|{tipo_doc_cliente}|{nro_doc}|{hash}
 *
 * @param {object} comprobante  Instancia del modelo Comprobante (con .Emisor y .Cliente cargados)
 * @param {string} hashCpe      DigestValue del CDR retornado por SUNAT
 * @returns {Promise<string>}   data URL base64 del PNG del QR
 */
async function generarQr(comprobante, hashCpe) {
  const emisorRuc = comprobante.Emisor ? comprobante.Emisor.ruc : "";
  const clienteTipoDoc = comprobante.Cliente
    ? comprobante.Cliente.tipo_documento_id || "-"
    : "-";
  const clienteNroDoc = comprobante.Cliente
    ? comprobante.Cliente.nrodoc || "-"
    : "-";

  const correlativoStr = String(comprobante.correlativo).padStart(8, "0");
  const fechaStr = formatFecha(comprobante.fecha_emision);

  const contenido = [
    emisorRuc,
    comprobante.tipo_comprobante_id,
    comprobante.serie,
    correlativoStr,
    parseFloat(comprobante.igv || 0).toFixed(2),
    parseFloat(comprobante.total || 0).toFixed(2),
    fechaStr,
    clienteTipoDoc,
    clienteNroDoc,
    hashCpe || "",
  ].join("|");

  const qrDataUrl = await QRCode.toDataURL(contenido, {
    errorCorrectionLevel: "M",
    width: 200,
    margin: 1,
  });

  return qrDataUrl;
}

function formatFecha(fecha) {
  if (!fecha) return "";
  return new Date(fecha).toISOString().split("T")[0];
}

module.exports = { generarQr };
