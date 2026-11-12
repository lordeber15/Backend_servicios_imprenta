const { ValidationError, NotFoundError } = require("../../../utils/errors");
const dispositivos = require("../../../../application/services/notifier/dispositivos.service");
const notificaciones = require("../../../../application/services/notifier/notificaciones.service");
const pagos = require("../../../../application/services/notifier/pagos.service");
const { hoyEnLima } = require("../../../../application/services/notifier/horaLima");
const { registrar } = require("../../../../application/services/auditoria.service");

/**
 * PAGOS YAPE/PLIN (Pagos Notifier)
 *
 * Rutas de la app Android (X-Device-Key): enlazar, latido e ingesta.
 * Rutas del panel (JWT, solo Administrador, ver permisos.js): pagos,
 * no reconocidas y dispositivos.
 *
 * El contrato JSON (camelCase) es el que espera la app: no cambiarlo sin
 * recompilar la APK.
 */

const MAX_LOTE = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAQUETE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/;
const NOMBRE_DISPOSITIVO = /^[\p{L}\p{N} ._\-()]+$/u;
const ISO_ESTRICTO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})$/;

const esTexto = (v, min, max) => typeof v === "string" && v.length >= min && v.length <= max;
const esOpcional = (v, max) => v === undefined || v === null || esTexto(v, 0, max);
const esIso = (v) => typeof v === "string" && ISO_ESTRICTO.test(v) && !Number.isNaN(Date.parse(v));

function validarItem(i) {
  return i && typeof i === "object"
    && esTexto(i.notifKey, 1, 256)
    && esTexto(i.packageName, 1, 128) && PAQUETE.test(i.packageName)
    && esOpcional(i.title, 256)
    && esTexto(i.text, 0, 2000)
    && esOpcional(i.bigText, 4000)
    && esIso(i.postedAt);
}

/** Filtros de pagos: from/to ISO, provider, q, page, pageSize. */
function leerFiltros(query) {
  const f = {
    from: query.from || undefined,
    to: query.to || undefined,
    provider: query.provider || undefined,
    q: query.q ? String(query.q).trim() : undefined,
    page: query.page === undefined ? 1 : Number(query.page),
    pageSize: query.pageSize === undefined ? 50 : Number(query.pageSize),
  };
  if ((f.from && !esIso(f.from)) || (f.to && !esIso(f.to))) throw new ValidationError("Rango de fechas inválido");
  if (f.provider && !["YAPE", "PLIN"].includes(f.provider)) throw new ValidationError("Proveedor inválido");
  if (f.q && f.q.length > 80) throw new ValidationError("Búsqueda demasiado larga");
  if (!Number.isInteger(f.page) || f.page < 1) throw new ValidationError("Página inválida");
  if (!Number.isInteger(f.pageSize) || f.pageSize < 1 || f.pageSize > 200) throw new ValidationError("Tamaño de página inválido");
  return f;
}

// ── App Android ──────────────────────────────────────────────────────────

async function enlazar(req, res) {
  const { enrollToken, name, appVersion } = req.body || {};
  if (!esTexto(enrollToken, 32, 128)) throw new ValidationError("Código de enlace inválido");
  if (!esTexto(name, 1, 80) || !NOMBRE_DISPOSITIVO.test(name)) throw new ValidationError("Nombre de dispositivo inválido");
  if (!esOpcional(appVersion, 32)) throw new ValidationError("Versión inválida");
  const r = await dispositivos.enlazar(enrollToken, name, appVersion);
  res.set("Cache-Control", "no-store").status(201).json(r);
}

async function yo(req, res) {
  await dispositivos.registrarLatido(req.device.id, req.headers["x-app-version"]);
  res.json({ id: req.device.id, name: req.device.name });
}

async function ingerir(req, res) {
  const items = req.body?.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_LOTE || !items.every(validarItem)) {
    throw new ValidationError("Lote inválido");
  }
  const r = await notificaciones.ingerir(req.device.id, items, req.headers["x-app-version"]);
  res.status(202).json(r);
}

// ── Panel (Administrador) ────────────────────────────────────────────────

async function crearCodigoEnlace(req, res) {
  const r = await dispositivos.crearCodigoEnlace(`${req.protocol}://${req.get("host")}`);
  await registrar(req, "PAGOS_QR_ENLACE", { entidad: "notifier_devices" });
  res.set("Cache-Control", "no-store").status(201).json(r);
}

async function listarDispositivos(_req, res) {
  res.json(await dispositivos.listar());
}

async function revocarDispositivo(req, res) {
  if (!UUID.test(req.params.id)) throw new ValidationError("Id inválido");
  await dispositivos.revocar(req.params.id);
  await registrar(req, "PAGOS_DISPOSITIVO_REVOCADO", { entidad: "notifier_devices", entidad_id: req.params.id });
  res.status(204).end();
}

async function listarNoReconocidas(req, res) {
  const status = req.query.status || "UNPARSED";
  if (!["UNPARSED", "IGNORED"].includes(status)) throw new ValidationError("Estado inválido");
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize, 10) || 50, 1), 100);
  res.json(await notificaciones.listarNoReconocidas(status, page, pageSize));
}

async function listarPagos(req, res) {
  res.json(await pagos.listar(leerFiltros(req.query)));
}

async function resumen(req, res) {
  const fecha = req.query.date;
  if (fecha !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new ValidationError("Fecha inválida");
  res.json(await pagos.resumen(fecha));
}

async function totales(req, res) {
  res.json(await pagos.totales(leerFiltros(req.query)));
}

async function exportarCsv(req, res) {
  const csv = await pagos.exportarCsv(leerFiltros(req.query));
  res
    .set("Content-Type", "text/csv; charset=utf-8")
    .set("Content-Disposition", `attachment; filename="pagos-${hoyEnLima()}.csv"`)
    .set("Cache-Control", "no-store")
    .send(csv);
}

async function detallePago(req, res) {
  if (!UUID.test(req.params.id)) throw new ValidationError("Id inválido");
  const p = await pagos.detalle(req.params.id);
  if (!p) throw new NotFoundError("Pago no encontrado");
  res.json(p);
}

module.exports = {
  enlazar, yo, ingerir,
  crearCodigoEnlace, listarDispositivos, revocarDispositivo,
  listarNoReconocidas, listarPagos, resumen, totales, exportarCsv, detallePago,
};
