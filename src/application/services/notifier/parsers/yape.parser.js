const { MONTO, SENSIBLE, cuerpoDe, limpiarNombre, normalizarMonto } = require("./comun");

// Yape v1 con prefijo "Yape!" y v2 con código de seguridad.
// Muestras reales en tests/unit/fixtures/notifier/yape.json.
const PAGO = new RegExp(
  String.raw`^(?:¡?Yape!?\s+)?(?<name>.+?)\s+te\s+envi[oó]\s+un\s+pago\s+por\s+S\/\s*${MONTO}`,
  "iu",
);
const CODIGO_SEGURIDAD = /c[oó]d(?:igo)?\.?\s*(?:de\s+)?seguridad\s+es:?\s*(?<code>\d{3,8})\b/iu;
const GENERICO = /^(notificaci[oó]n|yape|nueva notificaci[oó]n)$/iu;
const SALIENTE = /\b(enviaste|yapeaste|pagaste|realizaste un pago)\b/iu;

function parseYape(entrada) {
  const cuerpo = cuerpoDe(entrada);
  if (cuerpo.length === 0 || GENERICO.test(cuerpo)) return { kind: "ignored", reason: "generic-text", redact: false };
  if (SALIENTE.test(cuerpo)) return { kind: "ignored", reason: "outgoing", redact: true };

  const m = PAGO.exec(cuerpo);
  if (m?.groups) {
    const nombre = limpiarNombre(m.groups.name);
    const amount = normalizarMonto(m.groups.amount);
    if (nombre && amount) {
      const codigo = CODIGO_SEGURIDAD.exec(cuerpo)?.groups?.code ?? null;
      return { kind: "payment", ...nombre, amount, securityCode: codigo };
    }
  }

  if (SENSIBLE.test(cuerpo)) return { kind: "ignored", reason: "sensitive", redact: true };
  return { kind: "unparsed" };
}

module.exports = { parseYape };
