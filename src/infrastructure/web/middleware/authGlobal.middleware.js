/**
 * AUTENTICACIÓN GLOBAL CON LISTA BLANCA
 *
 * Exige token en toda la API salvo en las rutas públicas declaradas abajo.
 * Se monta una sola vez en app.js, antes del registro de rutas: todos los
 * routers usan rutas completas sin prefijo, así que este middleware los cubre.
 *
 * MODO AUDITORÍA (AUTH_ENFORCE=false, IGNORADO en producción):
 * Deja pasar las peticiones sin token pero las registra en el log. Sirve para
 * desplegar sin riesgo y comprobar en la práctica qué consumos quedarían fuera
 * antes de activar el bloqueo. Con AUTH_ENFORCE=true (por defecto) se aplica el 401.
 *
 * Ojo: el modo auditoría solo afecta a las rutas que estaban abiertas. Las que
 * ya declaraban authenticate por sí mismas (sunat, guia, formatos, login,
 * resumen_diario, comunicacion_baja) lo siguen exigiendo siempre — se mantiene
 * a propósito ese authenticate redundante para no relajar nunca lo ya protegido.
 */

const authenticate = require("./auth.middleware");

// Rutas públicas: no requieren token.
const PUBLIC_EXACT = [
  { method: "POST", path: "/auth/login" },   // necesario para obtener el token
  { method: "POST", path: "/auth/refresh" }, // se autentica con la cookie httpOnly
  { method: "POST", path: "/auth/logout" },  // debe funcionar con el access token ya vencido
];

// Prefijos públicos: health check, imágenes estáticas y documentación.
// (/uploads y /api-docs se montan antes que este middleware, se listan por claridad.)
const PUBLIC_PREFIXES = ["/health", "/uploads", "/api-docs"];

// En producción la autenticación no se puede apagar con una variable de
// entorno: un .env mal copiado dejaría toda la API abierta.
const AUTH_ENFORCE = process.env.NODE_ENV === "production" || process.env.AUTH_ENFORCE !== "false";
if (process.env.NODE_ENV === "production" && process.env.AUTH_ENFORCE === "false") {
  console.warn("[Auth] AUTH_ENFORCE=false se ignora en producción: la autenticación sigue activa");
}

function esPublica(req) {
  if (req.method === "OPTIONS") return true; // preflight CORS
  if (PUBLIC_PREFIXES.some((p) => req.path.startsWith(p))) return true;
  return PUBLIC_EXACT.some((r) => r.method === req.method && r.path === req.path);
}

const authGlobal = (req, res, next) => {
  if (esPublica(req)) return next();

  const tieneToken = req.headers.authorization?.startsWith("Bearer ");

  if (!tieneToken && !AUTH_ENFORCE) {
    console.warn(
      `[AUTH-AUDIT] ${req.method} ${req.path} sin token — con AUTH_ENFORCE=true devolvería 401`
    );
    return next();
  }

  return authenticate(req, res, next);
};

module.exports = authGlobal;
module.exports.AUTH_ENFORCE = AUTH_ENFORCE;
module.exports.esPublica = esPublica;
