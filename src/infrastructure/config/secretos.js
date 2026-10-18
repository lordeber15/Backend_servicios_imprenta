/**
 * Verificación de secretos al arrancar (API y worker).
 *
 * - JWT_SECRET (≥ 32 caracteres): firma los access tokens; uno corto o
 *   filtrado permite fabricar tokens de Administrador.
 *   Generar: openssl rand -base64 64 | tr -d '\n'
 * - DATA_ENCRYPTION_KEY (32 bytes base64): descifra las credenciales SUNAT
 *   del emisor (clave SOL, client_secret). Generar: openssl rand -base64 32
 *
 * En producción un secreto faltante o débil detiene el proceso; fuera de
 * producción solo avisa (salvo JWT_SECRET vacío en la API).
 */
const { llave } = require("../utils/cifrado");

function verificarSecretos({ jwt = true } = {}) {
  const prod = process.env.NODE_ENV === "production";
  const problemas = [];

  if (jwt) {
    const largo = (process.env.JWT_SECRET || "").length;
    if (largo < 32) {
      problemas.push({
        fatal: prod || !largo,
        msg: `JWT_SECRET ${largo ? `tiene solo ${largo} caracteres` : "no está definido"} (mínimo 32). ` +
          "Genere uno con: openssl rand -base64 64 | tr -d '\\n'",
      });
    }
  }
  try {
    llave();
  } catch (e) {
    problemas.push({ fatal: prod, msg: `${e.message}. Sin ella no se pueden usar las credenciales SUNAT del emisor.` });
  }

  for (const p of problemas) console[p.fatal ? "error" : "warn"](`[Seguridad] ${p.msg}`);
  if (problemas.some((p) => p.fatal)) process.exit(1);
}

module.exports = { verificarSecretos };
