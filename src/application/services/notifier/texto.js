const crypto = require("crypto");

// Caracteres de control (salvo \n y \t), marcas bidi y de ancho cero.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const BIDI_ZW = /[​-‏‪-‮⁠-⁩﻿]/g;

/** Normaliza texto externo antes de parsear o guardar: NFC, sin control ni bidi, espacios colapsados. */
function normalizarTexto(entrada) {
  if (!entrada) return "";
  return String(entrada)
    .normalize("NFC")
    .replace(CONTROL, "")
    .replace(BIDI_ZW, "")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Enmascara un nombre para logs: "MARIA QUISPE" -> "M*** Q***". Nunca loguear el nombre completo. */
function enmascararNombre(nombre) {
  if (!nombre) return "";
  return nombre
    .trim()
    .split(/\s+/)
    .map((parte) => (parte.length > 0 ? `${parte[0]}***` : parte))
    .join(" ");
}

function sha256Hex(valor) {
  return crypto.createHash("sha256").update(valor, "utf8").digest("hex");
}

/** Token aleatorio URL-safe (por defecto 256 bits). */
function tokenAleatorio(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

// CSV RFC 4180 con neutralización de fórmulas (= + - @ al inicio).
const INICIO_FORMULA = /^[=+\-@\t\r]/;

function celdaCsv(valor) {
  if (valor === null || valor === undefined) return "";
  let s = String(valor);
  if (INICIO_FORMULA.test(s)) s = `'${s}`;
  if (/[",\r\n']/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function filaCsv(valores) {
  return valores.map(celdaCsv).join(",") + "\r\n";
}

module.exports = { normalizarTexto, enmascararNombre, sha256Hex, tokenAleatorio, celdaCsv, filaCsv };
