const { MONTO, SENSIBLE, cuerpoDe, limpiarNombre, normalizarMonto } = require("./comun");

// App Interbank: "X te ha plineado S/ 260.00".
// Muestras reales en tests/unit/fixtures/notifier/plin.json.
const PAGO = new RegExp(String.raw`^(?<name>.+?)\s+te\s+ha\s+plineado\s+S\/\s*${MONTO}`, "iu");
const SALIENTE = /\b(plineaste|enviaste|transferiste)\b/iu;
const MENCIONA_PLIN = /plin/iu;

/**
 * La app de Interbank emite muchas notificaciones que no son Plin (consumos, claves).
 * Esas se ignoran con el texto redactado. Solo lo que menciona "plin" y no
 * coincide queda como UNPARSED para mejorar el parser.
 */
function parsePlin(entrada) {
  const cuerpo = cuerpoDe(entrada);
  if (cuerpo.length === 0) return { kind: "ignored", reason: "generic-text", redact: false };
  if (SALIENTE.test(cuerpo)) return { kind: "ignored", reason: "outgoing", redact: true };

  const m = PAGO.exec(cuerpo);
  if (m?.groups) {
    const nombre = limpiarNombre(m.groups.name);
    const amount = normalizarMonto(m.groups.amount);
    if (nombre && amount) return { kind: "payment", ...nombre, amount, securityCode: null };
  }

  if (SENSIBLE.test(cuerpo)) return { kind: "ignored", reason: "sensitive", redact: true };

  if (MENCIONA_PLIN.test(cuerpo)) return { kind: "unparsed" };
  return { kind: "ignored", reason: "not-plin", redact: true };
}

module.exports = { parsePlin };
