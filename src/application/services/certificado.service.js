"use strict";
/**
 * Vigencia del certificado digital de firma (SUNAT_CERT_PATH).
 * Un certificado vencido detiene toda la facturación: se avisa 30 días antes.
 */
const forge = require("node-forge");
const { loadCertificate } = require("../../infrastructure/external_services/sunat/certificateLoader");

const DIAS_AVISO = Number(process.env.CERT_DIAS_AVISO || 30);

/** @returns {{ estado: "ok"|"por_vencer"|"vencido"|"error", dias_restantes?: number, vence?: string, error?: string }} */
function estadoCertificado() {
  try {
    const { SUNAT_CERT_PATH: ruta, SUNAT_CERT_PASSWORD: clave } = process.env;
    if (!ruta || !clave) return { estado: "error", error: "Certificado no configurado" };
    const { certPem } = loadCertificate(ruta, clave);
    const vence = forge.pki.certificateFromPem(certPem).validity.notAfter;
    const dias = Math.floor((vence.getTime() - Date.now()) / 86_400_000);
    return {
      estado: dias < 0 ? "vencido" : dias <= DIAS_AVISO ? "por_vencer" : "ok",
      dias_restantes: dias,
      vence: vence.toISOString().slice(0, 10),
    };
  } catch (err) {
    // Sin ruta ni detalles en el mensaje: este estado puede llegar a la UI.
    return { estado: "error", error: /no encontrado/i.test(err.message) ? "Archivo de certificado no encontrado" : "No se pudo leer el certificado" };
  }
}

module.exports = { estadoCertificado };
