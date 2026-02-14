/**
 * FIRMADOR DIGITAL DE XML
 * 
 * Este módulo se encarga de aplicar la firma digital X509 (XMLDSig) sobre los 
 * comprobantes electrónicos, requisito indispensable para SUNAT.
 * 
 * @module services/sunat/xmlSigner
 */

/**
 * Firma un XML UBL 2.1 con XMLDSig usando los algoritmos requeridos por SUNAT:
 *  - Firma:              RSA-SHA1
 *  - Canonicalización:   C14N exclusivo sin comentarios
 *  - Digest:             SHA-1
 *
 * La firma se inyecta dentro del nodo <ext:ExtensionContent/> que ya debe
 * existir vacío en el XML generado por el builder correspondiente.
 *
 * @param {string} xmlString   XML sin firmar como string UTF-8
 * @param {string} certPath    Ruta al archivo .p12/.pfx
 * @param {string} certPassword  Contraseña del certificado
 * @returns {string}  XML con la firma digital incrustada
 */
function signXml(xmlString, certPath, certPassword) {
  const { privateKeyPem, certBase64 } = certificateLoader.loadCertificate(
    certPath,
    certPassword
  );

  const sig = new crypto.SignedXml({ idMode: "wssecurity" });

  // Algoritmos exigidos por SUNAT
  sig.signatureAlgorithm =
    "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
  sig.canonicalizationAlgorithm =
    "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";

  // Referencia al documento completo con enveloped-signature + c14n
  sig.addReference({
    xpath: "/*",
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    ],
  });

  sig.signingKey = privateKeyPem;

  // Incluir el certificado X.509 en el bloque KeyInfo
  sig.keyInfoProvider = {
    getKeyInfo: () =>
      `<ds:X509Data><ds:X509Certificate>${certBase64}</ds:X509Certificate></ds:X509Data>`,
    getKey: () => Buffer.from(privateKeyPem),
  };

  sig.computeSignature(xmlString);
  const signedXml = sig.getSignedXml();

  // La librería inserta la firma como último hijo del elemento raíz.
  // SUNAT requiere que esté dentro de <ext:ExtensionContent/>.
  // Si el builder ya dejó el ExtensionContent vacío, reemplazamos:
  return signedXml.replace(
    "<ext:ExtensionContent/>",
    `<ext:ExtensionContent>${extractSignatureBlock(signedXml)}</ext:ExtensionContent>`
  );
}

/**
 * Extrae el bloque <Signature ...>...</Signature> del XML firmado.
 */
function extractSignatureBlock(signedXml) {
  const match = signedXml.match(/<Signature[\s\S]*?<\/Signature>/);
  return match ? match[0] : "";
}

module.exports = { signXml };
