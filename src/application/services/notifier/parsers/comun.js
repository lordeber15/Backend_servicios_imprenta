const { normalizarTexto } = require("../texto");

/**
 * Piezas comunes de los parsers de Yape y Plin.
 *
 * Un parser recibe { title, text, bigText } y devuelve uno de:
 *   { kind: "payment", senderName, nameMasked, amount, securityCode }
 *   { kind: "ignored", reason, redact }   redact = guardar el texto redactado
 *   { kind: "unparsed" }
 * amount es un string decimal con 2 decimales ("1250.50"), nunca number.
 */

/** Monto en soles: "1,250.50" | "15.72" | "20" | "7.5". El punto final de oración no se consume. */
const MONTO = String.raw`(?<amount>\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?=\.?(?:\s|$))`;

/** Texto que parece contener un código secreto (OTP, clave, token). */
const SENSIBLE = /\b(c[oó]digo|clave|token|otp|contrase[ñn]a|pin)\b[^\d]{0,40}\d{4,}/iu;

/** "1,250.5" -> "1250.50" */
function normalizarMonto(crudo) {
  const plano = crudo.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(plano)) return null;
  const [entero, dec = ""] = plano.split(".");
  const n = `${BigInt(entero)}.${dec.padEnd(2, "0")}`;
  return n === "0.00" ? null : n;
}

/** Cuerpo a parsear: bigText si existe (texto completo), si no text. Ya normalizado. */
function cuerpoDe(entrada) {
  const big = normalizarTexto(entrada.bigText);
  return big.length > 0 ? big : normalizarTexto(entrada.text);
}

function limpiarNombre(crudo) {
  const senderName = normalizarTexto(crudo).slice(0, 160);
  if (senderName.length < 2 || /\d/.test(senderName)) return null;
  return { senderName, nameMasked: senderName.endsWith("*") };
}

module.exports = { MONTO, SENSIBLE, normalizarMonto, cuerpoDe, limpiarNombre };
