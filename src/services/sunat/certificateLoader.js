"use strict";
const forge = require("node-forge");
const fs = require("fs");
const path = require("path");
const NodeCache = require("node-cache");

// Cache por 1 hora para evitar leer el P12 en cada request
const certCache = new NodeCache({ stdTTL: 3600 });

/**
 * Carga el certificado P12/PFX y extrae los componentes necesarios para la firma XML.
 * @param {string} certPath  Ruta al archivo .p12/.pfx
 * @param {string} certPassword  Contraseña del certificado
 * @returns {{ privateKeyPem: string, certPem: string, certBase64: string }}
 */
function loadCertificate(certPath, certPassword) {
  const absPath = path.isAbsolute(certPath)
    ? certPath
    : path.join(process.cwd(), certPath);

  const cacheKey = absPath;
  if (certCache.has(cacheKey)) return certCache.get(cacheKey);

  if (!fs.existsSync(absPath)) {
    throw new Error(`Certificado no encontrado en: ${absPath}`);
  }

  const p12Buffer = fs.readFileSync(absPath);
  // Convertir Buffer a string binaria para node-forge
  const p12Der = p12Buffer.toString("binary");
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, certPassword);

  // Extraer clave privada
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });

  const keyBagItems = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
  const certBagItems = certBags[forge.pki.oids.certBag];

  if (!keyBagItems || keyBagItems.length === 0) {
    throw new Error("No se encontró clave privada en el certificado P12");
  }
  if (!certBagItems || certBagItems.length === 0) {
    throw new Error("No se encontró certificado X.509 en el P12");
  }

  const privateKeyObj = keyBagItems[0].key;
  const certObj = certBagItems[0].cert;

  const privateKeyPem = forge.pki.privateKeyToPem(privateKeyObj);
  const certPem = forge.pki.certificateToPem(certObj);

  // Valor base64 puro del certificado DER (para ds:X509Certificate en el XML)
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certObj));
  const certBase64 = forge.util.encode64(certDer.getBytes());

  const result = { privateKeyPem, certPem, certBase64 };
  certCache.set(cacheKey, result);
  return result;
}

module.exports = { loadCertificate };
