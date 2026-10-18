"use strict";
/**
 * CIFRADO DE SECRETOS EN LA BD (AES-256-GCM)
 *
 * Para credenciales de terceros que la app necesita en claro para usarlas
 * (clave SOL, client_secret de la API de guías). Un hash no sirve: hay que
 * poder enviarlas a SUNAT.
 *
 * - Llave: DATA_ENCRYPTION_KEY, 32 bytes en base64, FUERA de la BD. Un volcado
 *   de la base (backup robado, inyección SQL) no basta para leerlas.
 *   Generar: openssl rand -base64 32
 * - Formato guardado: "v1:<iv>:<tag>:<cifrado>" (base64url).
 * - AAD (contexto): p. ej. "emisor:1:clave_sol". El texto cifrado queda atado
 *   a su fila y campo; copiarlo a otra fila o campo hace fallar el descifrado.
 *
 * Si se pierde la llave no hay recuperación: el administrador vuelve a
 * ingresar las credenciales en el perfil de la empresa.
 */
const crypto = require("crypto");

const VERSION = "v1";

function llave() {
  const b64 = process.env.DATA_ENCRYPTION_KEY;
  if (!b64) throw new Error("DATA_ENCRYPTION_KEY no está configurada");
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("DATA_ENCRYPTION_KEY debe tener 32 bytes en base64 (openssl rand -base64 32)");
  return k;
}

const hayLlave = () => {
  try { llave(); return true; } catch { return false; }
};

/** @returns {string} "v1:iv:tag:ct" */
function cifrar(texto, contexto) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", llave(), iv);
  c.setAAD(Buffer.from(contexto, "utf8"));
  const ct = Buffer.concat([c.update(String(texto), "utf8"), c.final()]);
  return [VERSION, iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(":");
}

/** @throws si la llave no corresponde, el contexto no coincide o el dato fue alterado */
function descifrar(guardado, contexto) {
  const [v, iv, tag, ct] = String(guardado).split(":");
  if (v !== VERSION || !iv || !tag || ct === undefined) throw new Error("Formato de dato cifrado desconocido");
  const d = crypto.createDecipheriv("aes-256-gcm", llave(), Buffer.from(iv, "base64url"));
  d.setAAD(Buffer.from(contexto, "utf8"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

module.exports = { cifrar, descifrar, hayLlave, llave };
