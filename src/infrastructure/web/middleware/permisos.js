/**
 * MATRIZ DE PERMISOS (autorización central, DENEGAR POR DEFECTO)
 *
 * Toda ruta autenticada debe figurar aquí con los cargos que la pueden usar.
 * Una ruta que no figure responde 403: olvidar una regla nunca abre acceso.
 * La prueba tests/integracion/permisos.prueba.js recorre el router de Express
 * y falla si alguna ruta no tiene regla (o si queda una regla sin ruta).
 *
 * formato (opcional): para el cargo Usuario, además del rol se exige tener
 * asignado ese formato (los mismos que habilitan las pantallas del menú:
 * ticket, boleta, factura, notacredito, guiarem, guiatransp, ingresos,
 * cotizacion). El Administrador no los necesita. Puede ser una lista
 * (cualquiera sirve) o una función (req) => lista.
 *
 * Los `authorize(...)` que ya tenían algunas rutas se mantienen como segunda
 * barrera; la fuente de verdad es esta tabla.
 */
const { ForbiddenError, UnauthorizedError } = require("../../utils/errors");
const { esPublica } = require("./authGlobal.middleware");

const A = ["Administrador"];
const T = ["Administrador", "Usuario"];

// Formato que exige emitir cada tipo de comprobante.
const FORMATO_POR_TIPO = { "01": "factura", "03": "boleta", "07": "notacredito" };
const GUIAS = ["guiarem", "guiatransp"];
const CAJA = ["ticket", "boleta", "factura", "notacredito"]; // pantallas que operan con la caja

/** [método, ruta Express, cargos, formato?] — el orden importa: gana la primera que coincide. */
const REGLAS = [
  // ── Sesión y usuarios ──────────────────────────────────────────────────
  ["PUT", "/auth/password", T],
  ["GET", "/login", A],
  ["POST", "/login", A],
  ["PUT", "/login/:id", A],
  ["DELETE", "/login/:id", A],
  ["PUT", "/login/:id/image", T], // propio o admin: authorizeSelfOrAdmin en la ruta
  ["GET", "/formatos", T],
  ["GET", "/formatos/usuario/:id", T], // propio o admin: authorizeSelfOrAdmin en la ruta
  ["PUT", "/formatos/usuario/:id", A],

  // ── Facturación electrónica ────────────────────────────────────────────
  ["GET", "/comprobante", T],
  ["GET", "/comprobante/lista", T],
  ["POST", "/comprobante/emision", T, (req) => [FORMATO_POR_TIPO[req.body?.tipo_comprobante_id]].filter(Boolean)],
  ["POST", "/comprobante/emitir", T, Object.values(FORMATO_POR_TIPO)],
  ["POST", "/comprobante/:id/reenviar", T, Object.values(FORMATO_POR_TIPO)],
  ["GET", "/comprobante/:id/estado", T],
  ["GET", "/comprobante/:id/pdf", T],
  ["GET", "/comprobante/:id/xml", T],
  ["GET", "/comprobante/:id/cdr", T],
  ["PUT", "/comprobante/:id", A],
  ["DELETE", "/comprobante/:id", A],
  ["POST", "/admin/recuperar-estados", A],
  ["GET", "/sunat/pendientes", T],
  ["GET", "/detalle", T],
  ["PUT", "/detalle/:id", A],
  ["DELETE", "/detalle/:id", A],
  ["GET", "/guia", T],
  ["POST", "/guia/emision", T, (req) => [req.body?.tipo_guia === "31" ? "guiatransp" : "guiarem"]],
  ["POST", "/guia/emitir", T, GUIAS],
  ["GET", "/guia/:id/estado", T],
  ["GET", "/guia/:id/pdf", T],
  ["GET", "/guia/:id/xml", T],
  // Anulaciones ante SUNAT: solo el administrador.
  ["POST", "/comunicacion-baja", A],
  ["GET", "/comunicacion-baja/:id/consultar-ticket", A],
  ["POST", "/resumen-diario", A],
  ["GET", "/resumen-diario/:id/consultar-ticket", A],

  // ── Clientes (los crean las pantallas de venta; editar/borrar: admin) ──
  ["GET", "/cliente", T],
  ["GET", "/cliente/buscar/:nrodoc", T],
  ["POST", "/cliente", T],
  ["PUT", "/cliente/:id", A],
  ["DELETE", "/cliente/:id", A],

  // ── Catálogos: lectura para todos, escritura solo admin ────────────────
  ...["/emisor", "/serie", "/producto", "/moneda", "/unidad", "/tipo_comprobante", "/tipo_documento",
    "/tipo_afectacion", "/tabla_parametrica"]
    .flatMap((r) => [["GET", r, T], ["POST", r, A], ["PUT", `${r}/:id`, A], ["DELETE", `${r}/:id`, A]]),
  // Seguimiento SUNAT: solo lectura (lo escriben la emisión, el resumen y la baja).
  ["GET", "/cuota", T],
  ["GET", "/envio_resumen", A],
  ["GET", "/envio_resumen_detalle", A],
  ["PUT", "/emisor/:id/logo", A],

  // ── Ventas, caja y movimientos ─────────────────────────────────────────
  ["GET", "/ticket", T],
  ["POST", "/ticket", T, ["ticket"]],
  ["GET", "/ticket/:id/pdf", T],
  ["PUT", "/ticket/:id", A],
  ["DELETE", "/ticket/:id", A],
  ["GET", "/caja/actual", T],
  ["GET", "/caja/historial", A],
  ["POST", "/caja/apertura", A],
  ["PUT", "/caja/:id/cierre", A],
  ["GET", "/ventas/dia", T, ["ingresos", ...CAJA]],
  ["GET", "/ingresos", T],
  ["POST", "/ingresos", T, ["ingresos"]],
  ["PUT", "/ingresos/:id", A],
  ["DELETE", "/ingresos/:id", A],
  ["GET", "/egresos", T],
  ["POST", "/egresos", T, ["ingresos"]],
  ["PUT", "/egresos/:id", A],
  ["DELETE", "/egresos/:id", A],

  // ── Órdenes de servicio (dashboard) ────────────────────────────────────
  ["GET", "/servicios", T],
  ["GET", "/servicios/stats", T],
  ["POST", "/servicios", T],
  ["PUT", "/servicios/:id", A],
  ["DELETE", "/servicios/:id", A],

  // ── Cotizaciones (almanaques) ──────────────────────────────────────────
  ["GET", "/almanaque", T],
  ["GET", "/almanaque/:id", T],
  ["GET", "/almanaque/:id/pdf", T],
  ["POST", "/almanaque", T, ["cotizacion"]],
  ["PUT", "/almanaque/:id", T, ["cotizacion"]],
  ["DELETE", "/almanaque/:id", A],

  // ── Reportes, RENIEC, impresión ────────────────────────────────────────
  ["GET", "/reportes/documentos", A],
  ["GET", "/api/reniec/:dni", T],
  ["GET", "/qz/certificate", T],
  ["POST", "/qz/sign", T],
];

const aRegex = (ruta) => new RegExp(`^${ruta.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/:[A-Za-z_]+/g, "[^/]+")}/?$`);
const COMPILADAS = REGLAS.map(([metodo, ruta, roles, formato]) => ({ metodo, ruta, regex: aRegex(ruta), roles, formato }));

/** @returns {object|undefined} la regla que aplica a (método, ruta) */
function buscarRegla(metodo, ruta) {
  const m = metodo === "HEAD" ? "GET" : metodo;
  return COMPILADAS.find((r) => r.metodo === m && r.regex.test(ruta));
}

function permisos(req, _res, next) {
  if (esPublica(req)) return next();
  // Modo auditoría (AUTH_ENFORCE=false, solo fuera de producción): sin usuario no hay nada que evaluar.
  if (!req.user) return next(authGlobalEnforce() ? new UnauthorizedError() : undefined);

  const regla = buscarRegla(req.method, req.path);
  if (!regla) {
    console.warn(`[Permisos] ${req.method} ${req.path} sin regla en la matriz → 403`);
    return next(new ForbiddenError());
  }
  if (!regla.roles.includes(req.user.cargo)) return next(new ForbiddenError());

  if (regla.formato && req.user.cargo !== "Administrador") {
    const requeridos = typeof regla.formato === "function" ? regla.formato(req) : regla.formato;
    const tiene = req.user.formatos || [];
    if (requeridos.length && !requeridos.some((f) => tiene.includes(f))) {
      return next(new ForbiddenError(`Su usuario no tiene habilitado el formato: ${requeridos.join(" o ")}`));
    }
  }
  return next();
}

const authGlobalEnforce = () => require("./authGlobal.middleware").AUTH_ENFORCE;

module.exports = permisos;
module.exports.REGLAS = REGLAS;
module.exports.buscarRegla = buscarRegla;
