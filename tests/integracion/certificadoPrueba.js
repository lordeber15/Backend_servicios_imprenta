// Genera un certificado autofirmado (PFX) para firmar XML en las pruebas.
// Así las pruebas nunca usan el certificado real de la empresa.
const fs = require("fs");
const crypto = require("crypto");
const forge = require("node-forge");

function generarCertificadoPrueba(ruta) {
  const clave = crypto.randomBytes(12).toString("hex");
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 2 * 365 * 86_400_000);
  const nombre = [{ name: "commonName", value: "EMISOR PRUEBA 20000000001" }, { name: "countryName", value: "PE" }];
  cert.setSubject(nombre);
  cert.setIssuer(nombre);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], clave, { algorithm: "3des" });
  fs.writeFileSync(ruta, Buffer.from(forge.asn1.toDer(p12).getBytes(), "binary"), { mode: 0o600 });
  return clave;
}

module.exports = { generarCertificadoPrueba };
