const { Op, UniqueConstraintError } = require("sequelize");
const sequelize = require("../../../infrastructure/database/database");
const { NotifierRawNotification, NotifierPayment } = require("../../../infrastructure/database/models/notifier/notifier");
const { notifierConfig } = require("../../../infrastructure/config/notifier");
const { AppError } = require("../../../infrastructure/utils/errors");
const gateway = require("../../../infrastructure/web/realtime/notifier.gateway");
const { PARSERS } = require("./parsers");
const { normalizarTexto, sha256Hex } = require("./texto");
const { registrarLatido } = require("./dispositivos.service");

const EDAD_MAXIMA_MS = 7 * 24 * 60 * 60 * 1000; // más viejo: posible replay, se rechaza
const FUTURO_MAXIMO_MS = 5 * 60 * 1000;          // reloj del teléfono adelantado
const TARDE_MS = 10 * 60 * 1000;                 // llegó tarde: se marca en el panel
const VENTANA_REPETIDO_MS = 3 * 60 * 1000;       // "¿Repetido?" mismo nombre y monto
const REDACTADO = "[redactado]";

/**
 * Ingesta un lote del teléfono. Idempotente: el fingerprint se calcula SOLO en
 * el servidor (con el deviceId derivado de la clave) y es UNIQUE, así que
 * reenviar un lote cuenta duplicados en vez de crear filas.
 */
async function ingerir(deviceId, items, appVersion) {
  const desconocido = items.find((i) => !notifierConfig.paquetes.has(i.packageName));
  if (desconocido) throw new AppError("packageName no permitido", 422);

  const resultado = { accepted: 0, duplicates: 0, rejected: 0, parsed: 0, unparsed: 0, ignored: 0 };
  for (const item of items) {
    const salida = await ingerirUno(deviceId, notifierConfig.paquetes.get(item.packageName), item);
    resultado[salida]++;
    if (salida !== "duplicates" && salida !== "rejected") resultado.accepted++;
  }
  await registrarLatido(deviceId, appVersion);
  console.log(`[Pagos] Lote del dispositivo ${deviceId}: ${JSON.stringify(resultado)}`);
  return resultado;
}

async function ingerirUno(deviceId, provider, item) {
  const receivedAt = new Date();
  const postedAt = new Date(item.postedAt);
  const edad = receivedAt.getTime() - postedAt.getTime();
  if (Number.isNaN(postedAt.getTime()) || edad > EDAD_MAXIMA_MS || edad < -FUTURO_MAXIMO_MS) return "rejected";

  // NFC puede alargar el texto: recortar al tamaño de la columna después de normalizar.
  const title = normalizarTexto(item.title).slice(0, 256) || null;
  const text = normalizarTexto(item.text).slice(0, 2000);
  const bigText = normalizarTexto(item.bigText).slice(0, 4000) || null;
  const fingerprint = sha256Hex([deviceId, item.packageName, item.notifKey, postedAt.getTime(), text, bigText ?? ""].join("|"));

  const parsed = PARSERS[provider]({ title, text, bigText });
  const redactar = parsed.kind === "ignored" && parsed.redact;
  const status = parsed.kind === "payment" ? "PARSED" : parsed.kind === "unparsed" ? "UNPARSED" : "IGNORED";

  let posibleRepetidoDe = null;
  if (parsed.kind === "payment") {
    const rep = await NotifierPayment.findOne({
      where: {
        provider,
        sender_name: parsed.senderName,
        amount: parsed.amount,
        paid_at: {
          [Op.gte]: new Date(postedAt.getTime() - VENTANA_REPETIDO_MS),
          [Op.lte]: new Date(postedAt.getTime() + VENTANA_REPETIDO_MS),
        },
      },
      order: [["paid_at", "DESC"]],
      attributes: ["id"],
    });
    posibleRepetidoDe = rep?.id ?? null;
  }

  let raw;
  let pago = null;
  try {
    // El evento se emite después del commit: el panel nunca ve un pago que no quedó guardado.
    await sequelize.transaction(async (transaction) => {
      raw = await NotifierRawNotification.create({
        device_id: deviceId,
        package_name: item.packageName,
        provider,
        notif_key: item.notifKey,
        title,
        text: redactar ? REDACTADO : text,
        big_text: redactar ? null : bigText,
        posted_at: postedAt,
        received_at: receivedAt,
        fingerprint,
        status,
        ignore_reason: parsed.kind === "ignored" ? parsed.reason : null,
      }, { transaction });
      if (parsed.kind === "payment") {
        pago = await NotifierPayment.create({
          raw_notification_id: raw.id,
          provider,
          sender_name: parsed.senderName,
          name_masked: parsed.nameMasked,
          amount: parsed.amount,
          security_code: parsed.securityCode,
          paid_at: postedAt,
          late: edad > TARDE_MS,
          possible_duplicate_of_id: posibleRepetidoDe,
        }, { transaction });
      }
    });
  } catch (e) {
    if (e instanceof UniqueConstraintError) return "duplicates";
    throw e;
  }

  if (pago) {
    gateway.emitirPago({
      id: pago.id,
      provider,
      senderName: parsed.senderName,
      nameMasked: parsed.nameMasked,
      amount: parsed.amount,
      currency: "PEN",
      securityCode: parsed.securityCode,
      paidAt: postedAt.toISOString(),
      receivedAt: receivedAt.toISOString(),
      late: pago.late,
      possibleDuplicateOf: posibleRepetidoDe,
      deviceId,
    });
    return "parsed";
  }
  if (status === "UNPARSED") {
    gateway.emitirNoReconocida({ id: raw.id, provider, receivedAt: receivedAt.toISOString() });
    return "unparsed";
  }
  return "ignored";
}

async function listarNoReconocidas(status, page, pageSize) {
  const { count, rows } = await NotifierRawNotification.findAndCountAll({
    where: { status },
    order: [["received_at", "DESC"]],
    offset: (page - 1) * pageSize,
    limit: pageSize,
    attributes: ["id", "provider", "package_name", "title", "text", "big_text", "posted_at", "received_at", "status", "ignore_reason"],
  });
  return {
    total: count,
    page,
    pageSize,
    items: rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      packageName: r.package_name,
      title: r.title,
      text: r.text,
      bigText: r.big_text,
      postedAt: r.posted_at.toISOString(),
      receivedAt: r.received_at.toISOString(),
      status: r.status,
      ignoreReason: r.ignore_reason,
    })),
  };
}

module.exports = { ingerir, listarNoReconocidas };
