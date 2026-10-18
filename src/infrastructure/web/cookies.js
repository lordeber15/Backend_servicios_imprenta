/**
 * Cookie del refresh token.
 *
 * - httpOnly: JavaScript no puede leerla (un XSS no puede robar la sesión larga).
 * - SameSite=Strict + Path=/auth: solo viaja en peticiones del mismo sitio y
 *   solo a /auth/*; el resto de la API nunca la recibe.
 * - Secure: obligatoria en producción (HTTPS). En desarrollo (http://localhost)
 *   se desactiva salvo COOKIE_SECURE=true.
 */
const NOMBRE = "imprenta_rt";
const RUTA = "/auth";

const segura = () =>
  process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production";

const opciones = () => ({ httpOnly: true, secure: segura(), sameSite: "strict", path: RUTA });

function ponerRefresh(res, { token, expira }) {
  res.cookie(NOMBRE, token, { ...opciones(), expires: expira });
}

function borrarRefresh(res) {
  res.clearCookie(NOMBRE, opciones());
}

/** Lee la cookie sin depender de cookie-parser. */
function leerRefresh(req) {
  const cabecera = req.headers.cookie;
  if (!cabecera) return null;
  for (const parte of cabecera.split(";")) {
    const i = parte.indexOf("=");
    if (i > 0 && parte.slice(0, i).trim() === NOMBRE) {
      try { return decodeURIComponent(parte.slice(i + 1).trim()) || null; } catch { return null; }
    }
  }
  return null;
}

module.exports = { ponerRefresh, borrarRefresh, leerRefresh, NOMBRE };
