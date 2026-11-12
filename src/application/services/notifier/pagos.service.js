const { Op, fn, col, literal } = require("sequelize");
const { NotifierPayment, NotifierRawNotification } = require("../../../infrastructure/database/models/notifier/notifier");
const { filaCsv } = require("./texto");
const { LIMA_TZ, hoyEnLima, rangoDiaLima, formatearLima } = require("./horaLima");

const LIMITE_EXPORTACION = 10_000;
const ATRIBUTOS = ["id", "provider", "sender_name", "name_masked", "amount", "currency", "security_code",
  "paid_at", "late", "possible_duplicate_of_id", "created_at"];

function aDto(p) {
  return {
    id: p.id,
    provider: p.provider,
    senderName: p.sender_name,
    nameMasked: p.name_masked,
    amount: String(p.amount),
    currency: p.currency,
    securityCode: p.security_code,
    paidAt: p.paid_at.toISOString(),
    receivedAt: p.raw.received_at.toISOString(),
    late: p.late,
    possibleDuplicateOf: p.possible_duplicate_of_id,
    deviceId: p.raw.device_id,
  };
}

/** Filtros del Historial: from/to ISO, provider, q (nombre). */
function filtro(q) {
  const where = {};
  if (q.provider) where.provider = q.provider;
  if (q.q) where.sender_name = { [Op.iLike]: `%${q.q.replace(/[\\%_]/g, "\\$&")}%` };
  if (q.from || q.to) {
    where.paid_at = {};
    if (q.from) where.paid_at[Op.gte] = new Date(q.from);
    if (q.to) where.paid_at[Op.lt] = new Date(q.to);
  }
  return where;
}

const incluirRaw = (atributos = ["received_at", "device_id"]) => ({
  model: NotifierRawNotification, as: "raw", attributes: atributos,
});

async function listar(q) {
  const { count, rows } = await NotifierPayment.findAndCountAll({
    where: filtro(q),
    attributes: ATRIBUTOS,
    include: [incluirRaw()],
    order: [["paid_at", "DESC"]],
    offset: (q.page - 1) * q.pageSize,
    limit: q.pageSize,
  });
  return { total: count, page: q.page, pageSize: q.pageSize, items: rows.map(aDto) };
}

/** Detalle de un pago con el texto original (para disputas). */
async function detalle(id) {
  const p = await NotifierPayment.findByPk(id, {
    attributes: ATRIBUTOS,
    include: [incluirRaw(["received_at", "device_id", "posted_at", "title", "text", "big_text", "package_name"])],
  });
  if (!p) return null;
  return {
    ...aDto(p),
    raw: {
      title: p.raw.title,
      text: p.raw.text,
      bigText: p.raw.big_text,
      packageName: p.raw.package_name,
      postedAt: p.raw.posted_at.toISOString(),
    },
  };
}

async function agregar(where) {
  const filas = await NotifierPayment.findAll({
    where,
    attributes: ["provider", [fn("SUM", col("amount")), "total"], [fn("COUNT", col("id")), "count"]],
    group: ["provider"],
    raw: true,
  });
  const providers = ["YAPE", "PLIN"].map((provider) => {
    const g = filas.find((x) => x.provider === provider);
    return { provider, count: Number(g?.count ?? 0), total: g ? String(g.total) : "0.00" };
  });
  // Suma exacta en Postgres (NUMERIC) y ya formateada: el dinero nunca pasa por number.
  const [general] = await NotifierPayment.findAll({
    where,
    attributes: [[literal("COALESCE(SUM(amount), 0)::numeric(14,2)"), "total"], [fn("COUNT", col("id")), "count"]],
    raw: true,
  });
  return { providers, overall: { count: Number(general.count), total: String(general.total) } };
}

/** Totales de lo filtrado (Historial). */
const totales = (q) => agregar(filtro(q));

/** Total y conteo del día (Lima) por proveedor, más avisos no reconocidos del día. */
async function resumen(fecha = hoyEnLima()) {
  const { desde, hasta } = rangoDiaLima(fecha);
  const [tot, unparsed] = await Promise.all([
    agregar({ paid_at: { [Op.gte]: desde, [Op.lt]: hasta } }),
    NotifierRawNotification.count({ where: { status: "UNPARSED", received_at: { [Op.gte]: desde, [Op.lt]: hasta } } }),
  ]);
  return { date: fecha, timezone: LIMA_TZ, ...tot, unparsed };
}

/** CSV con celdas neutralizadas. No incluye el código de seguridad (minimización). */
async function exportarCsv(q) {
  const filas = await NotifierPayment.findAll({
    where: filtro(q),
    attributes: ATRIBUTOS,
    order: [["paid_at", "ASC"]],
    limit: LIMITE_EXPORTACION,
  });
  let out = "﻿" + filaCsv(["fecha_hora_lima", "proveedor", "nombre", "monto", "moneda", "llego_tarde", "posible_repetido", "id"]);
  for (const r of filas) {
    out += filaCsv([
      formatearLima(r.paid_at),
      r.provider,
      r.sender_name,
      String(r.amount),
      r.currency,
      r.late ? "si" : "no",
      r.possible_duplicate_of_id ? "si" : "no",
      r.id,
    ]);
  }
  return out;
}

module.exports = { listar, detalle, totales, resumen, exportarCsv };
