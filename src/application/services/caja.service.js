"use strict";
/**
 * CAJA GLOBAL
 *
 * Una sola caja abierta a la vez (índice único caja_una_abierta). Cada venta y
 * movimiento guarda el caja_id de la caja abierta al registrarse, y el cierre
 * suma por caja_id (antes se sumaba por fecha/hora y entraban ventas ajenas).
 *
 * Concurrencia: las ventas toman la caja con FOR SHARE y el cierre con
 * FOR UPDATE, así una venta no puede quedar asignada a una caja que se está
 * cerrando en ese mismo instante.
 */
const sequelize = require("../../infrastructure/database/database");
const AperturaCaja = require("../../infrastructure/database/models/caja/aperturaCaja");
const { ConflictError } = require("../../infrastructure/utils/errors");

// Comprobantes que SUNAT ya resolvió como válidos. El resto se lista como
// "pendiente SUNAT" para seguimiento, pero el dinero SÍ se cobró y cuenta.
const ESTADOS_SUNAT_OK = ["ACEPTADO", "OBSERVADO"];

/**
 * Caja abierta, bloqueada en modo compartido dentro de la transacción.
 * @throws {ConflictError} si no hay caja abierta
 */
async function exigirCajaAbierta(transaction) {
  const caja = await AperturaCaja.findOne({
    where: { estado: "abierta" },
    transaction,
    lock: transaction.LOCK.SHARE,
  });
  if (!caja) throw new ConflictError("No hay caja abierta. Abra la caja antes de registrar ventas.");
  return caja;
}

/** Caja abierta sin exigirla (para movimientos opcionales como ingresos/egresos). */
async function cajaAbiertaId(transaction) {
  const caja = await AperturaCaja.findOne({
    where: { estado: "abierta" },
    attributes: ["id"],
    transaction,
    ...(transaction ? { lock: transaction.LOCK.SHARE } : {}),
  });
  return caja?.id ?? null;
}

/**
 * Un movimiento de una caja ya cerrada no se modifica ni elimina: alteraría
 * un cierre ya cuadrado. Los movimientos sin caja (anteriores a la 0003) sí.
 * @throws {ConflictError}
 */
async function exigirCajaNoCerrada(cajaId, transaction) {
  if (!cajaId) return;
  const caja = await AperturaCaja.findByPk(cajaId, { attributes: ["id", "estado"], transaction });
  if (caja && caja.estado === "cerrada") {
    throw new ConflictError("El movimiento pertenece a una caja ya cerrada y no puede modificarse");
  }
}

// "efectivo" / "EFECTIVO" / null → "Efectivo"
const normalizarMetodo = (m) => {
  const s = String(m || "Efectivo").trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const c = (n) => Math.round(Number(n || 0) * 100); // a céntimos
const s = (cent) => cent / 100;

/**
 * Desglose de la caja por método de pago.
 * @returns {Promise<object>} ver forma en el return
 */
async function calcularDesglose(caja, transaction) {
  const q = async (sql) => (await sequelize.query(sql, { replacements: { id: caja.id }, transaction }))[0];

  const [tickets, ventas, notas, almanaques, ingresos, egresos, pendientes] = await Promise.all([
    q(`SELECT metodo_pago AS m, SUM(COALESCE(monto_cobrado, "precioTotal")) AS t
       FROM "Tickets" WHERE caja_id = :id GROUP BY 1`),
    q(`SELECT metodo_pago AS m, (COALESCE(forma_pago, 'Contado') = 'Crédito') AS credito, SUM(total) AS t
       FROM "Comprobante"
       WHERE caja_id = :id AND tipo_comprobante_id IN ('01','03') AND estado_sunat <> 'ANULADO'
       GROUP BY 1, 2`),
    q(`SELECT metodo_pago AS m, (COALESCE(forma_pago, 'Contado') = 'Crédito') AS credito, SUM(total) AS t
       FROM "Comprobante"
       WHERE caja_id = :id AND tipo_comprobante_id = '07' AND estado_sunat <> 'ANULADO'
       GROUP BY 1, 2`),
    q(`SELECT SUM("precioTotal") AS t FROM "almanaque" WHERE caja_id = :id AND tipo = 'venta'`),
    q(`SELECT metodo AS m, SUM(monto) AS t FROM "ingresos" WHERE caja_id = :id GROUP BY 1`),
    q(`SELECT metodo AS m, SUM(monto) AS t FROM "egresos" WHERE caja_id = :id GROUP BY 1`),
    q(`SELECT estado_sunat AS e, COUNT(*)::int AS n, SUM(total) AS t
       FROM "Comprobante"
       WHERE caja_id = :id AND tipo_comprobante_id IN ('01','03','07')
         AND estado_sunat NOT IN ('${ESTADOS_SUNAT_OK.join("','")}', 'ANULADO')
       GROUP BY 1`),
  ]);

  // Acumulación en céntimos por método de pago
  const metodos = {};
  const m = (nombre) =>
    (metodos[normalizarMetodo(nombre)] ??= { tickets: 0, comprobantes: 0, almanaques: 0, notas_credito: 0, ingresos: 0, egresos: 0 });
  let creditoFacturas = 0;
  let creditoNotas = 0;

  for (const r of tickets) m(r.m).tickets += c(r.t);
  for (const r of ventas) r.credito ? (creditoFacturas += c(r.t)) : (m(r.m).comprobantes += c(r.t));
  for (const r of notas) r.credito ? (creditoNotas += c(r.t)) : (m(r.m).notas_credito += c(r.t));
  if (almanaques[0]?.t) m("Efectivo").almanaques += c(almanaques[0].t); // sin método registrado: efectivo
  for (const r of ingresos) m(r.m).ingresos += c(r.t);
  for (const r of egresos) m(r.m).egresos += c(r.t);
  m("Efectivo"); // siempre presente

  const por_metodo = {};
  let ventasTickets = 0;
  let ventasComprobantes = 0;
  let totalNeto = 0;
  for (const [nombre, v] of Object.entries(metodos)) {
    const neto = v.tickets + v.comprobantes + v.almanaques - v.notas_credito + v.ingresos - v.egresos;
    por_metodo[nombre] = Object.fromEntries(Object.entries({ ...v, neto }).map(([k, x]) => [k, s(x)]));
    ventasTickets += v.tickets + v.almanaques;
    ventasComprobantes += v.comprobantes - v.notas_credito;
    totalNeto += neto;
  }

  const efectivoNeto = c(por_metodo.Efectivo.neto);
  const pendientesCent = pendientes.reduce((a, r) => a + c(r.t), 0);

  return {
    por_metodo,
    credito: { facturas: s(creditoFacturas), notas_credito: s(creditoNotas), neto: s(creditoFacturas - creditoNotas) },
    sunat_pendientes: {
      cantidad: pendientes.reduce((a, r) => a + r.n, 0),
      total: s(pendientesCent),
      por_estado: Object.fromEntries(pendientes.map((r) => [r.e, { cantidad: r.n, total: s(c(r.t)) }])),
    },
    ventas_tickets: s(ventasTickets),
    ventas_comprobantes: s(ventasComprobantes),
    total_cobrado: s(totalNeto),
    total_efectivo: s(efectivoNeto),
    total_yape: por_metodo.Yape ? por_metodo.Yape.neto : 0,
    efectivo_esperado: s(c(caja.monto_apertura) + efectivoNeto),
  };
}

module.exports = { exigirCajaAbierta, exigirCajaNoCerrada, cajaAbiertaId, calcularDesglose, normalizarMetodo };
