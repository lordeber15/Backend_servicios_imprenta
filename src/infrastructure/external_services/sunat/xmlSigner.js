/**
 * FIRMADOR DIGITAL DE XML
 *
 * Este módulo se encarga de aplicar la firma digital X509 (XMLDSig) sobre los
 * comprobantes electrónicos, requisito indispensable para SUNAT.
 *
 * @module services/sunat/xmlSigner
 */

const crypto = require("xml-crypto");
const certificateLoader = require("./certificateLoader");

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
  const { privateKeyPem, certPem } = certificateLoader.loadCertificate(
    certPath,
    certPassword
  );

  const sig = new crypto.SignedXml({
    privateKey: privateKeyPem,
    publicCert: certPem,
    signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
    canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
  });

  // Referencia al documento completo.
  // xpath:"/*" selecciona el nodo, uri:"" genera <Reference URI="">
  // isEmptyUri:true evita que xml-crypto agregue atributo Id al root
  sig.addReference({
    xpath: "/*",
    uri: "",
    isEmptyUri: true,
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    ],
  });

  sig.computeSignature(xmlString);
  let signedXml = sig.getSignedXml();

  // xml-crypto inserta la Signature como último hijo del root.
  // SUNAT requiere que esté dentro de <ext:ExtensionContent/>.
  // 1. Extraer el bloque Signature
  const signatureBlock = extractSignatureBlock(signedXml);

  // 2. Remover la Signature de su posición actual (fin del root)
  signedXml = signedXml.replace(/<Signature[\s\S]*?<\/Signature>/, "");

  // 3. Insertar dentro del ExtensionContent vacío
  signedXml = signedXml.replace(
    "<ext:ExtensionContent/>",
    `<ext:ExtensionContent>${signatureBlock}</ext:ExtensionContent>`
  );

  return signedXml;
}

/**
 * Extrae el bloque <Signature ...>...</Signature> del XML firmado.
 */
function extractSignatureBlock(signedXml) {
  const match = signedXml.match(/<Signature[\s\S]*?<\/Signature>/);
  return match ? match[0] : "";
}

module.exports = { signXml };
