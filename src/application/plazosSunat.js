"use strict";
/**
 * PLAZOS DE ENVÍO A SUNAT (días calendario, fecha de Lima)
 *
 * Fuente: SUNAT, revisado el 2026-10-17.
 * - Factura y sus notas (serie F…): hasta 3 días calendario contados desde el
 *   día siguiente a la emisión (R.S. 003-2023/SUNAT). Emitida el día D, el
 *   último día válido es D+3.
 * - Boleta y sus notas (serie B…), envío individual: en la fecha de emisión
 *   o hasta 5 días calendario (cpe.sunat.gob.pe). Por Resumen Diario el plazo
 *   es de 7 días, pero este sistema envía las boletas individualmente.
 *
 * Antes se aplicaban 3 días a todo y se medían en horas desde la medianoche
 * UTC: una boleta todavía válida quedaba FUERA_PLAZO y una factura del día D
 * vencía a las 19:00 (hora Perú) del D+3.
 *
 * Configurables por si SUNAT cambia la norma: PLAZO_DIAS_FACTURA, PLAZO_DIAS_BOLETA.
 * Ante la duda, el plazo debe ser el más largo: un envío tardío solo produce
 * un rechazo de SUNAT; marcar FUERA_PLAZO antes de tiempo pierde un
 * comprobante válido.
 */
const { hoyLocal } = require("../infrastructure/utils/fecha");

const PLAZO_FACTURA = Number(process.env.PLAZO_DIAS_FACTURA || 3);
const PLAZO_BOLETA = Number(process.env.PLAZO_DIAS_BOLETA || 5);

/** Boleta o nota sobre boleta: la serie empieza con B (la NC usa la letra del comprobante que modifica). */
const esDeBoleta = (tipo, serie) => tipo === "03" || String(serie || "").toUpperCase().startsWith("B");

/** @returns {number} días calendario de plazo después de la fecha de emisión */
const plazoDias = (tipo, serie) => (esDeBoleta(tipo, serie) ? PLAZO_BOLETA : PLAZO_FACTURA);

/** "YYYY-MM-DD" de una fecha guardada a medianoche UTC (convención del sistema) o un string. */
const aFecha = (f) => (typeof f === "string" ? f.slice(0, 10) : new Date(f).toISOString().slice(0, 10));

const sumarDias = (fecha, dias) => {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

/** Último día (inclusive, hora de Lima) en que SUNAT acepta el envío. */
const fechaLimite = (fechaEmision, tipo, serie) => sumarDias(aFecha(fechaEmision), plazoDias(tipo, serie));

/** true si hoy (Lima) ya pasó el último día de envío. */
const vencido = (fechaEmision, tipo, serie, hoy = hoyLocal()) => hoy > fechaLimite(fechaEmision, tipo, serie);

/** Días que quedan para el límite (0 = vence hoy, negativo = vencido). */
const diasRestantes = (fechaEmision, tipo, serie, hoy = hoyLocal()) =>
  Math.round((new Date(`${fechaLimite(fechaEmision, tipo, serie)}T00:00:00Z`) - new Date(`${hoy}T00:00:00Z`)) / 86_400_000);

module.exports = { plazoDias, fechaLimite, vencido, diasRestantes, sumarDias, esDeBoleta };
