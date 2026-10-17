/**
 * FECHA Y HORA LOCALES DEL NEGOCIO
 *
 * El contenedor corre en UTC a propósito: las fechas que llegan del frontend
 * como "YYYY-MM-DD" se guardan a medianoche UTC, y los builders de XML/PDF
 * dependen de esa convención. Por eso NO se fija TZ en el proceso.
 *
 * Lo que sí debe ser local es "qué día/hora es AHORA" (apertura de caja,
 * ventas del día, lote de bajas). Desde las 19:00 en Perú la fecha UTC ya es
 * la del día siguiente; estas funciones fijan la zona de forma explícita.
 */

const ZONA = process.env.APP_TIMEZONE || "America/Lima";

/** Fecha local actual en formato YYYY-MM-DD. */
const hoyLocal = () => new Date().toLocaleDateString("en-CA", { timeZone: ZONA });

/** Hora local actual en formato HH:MM:SS (24 h). */
const horaLocal = () =>
  new Date().toLocaleTimeString("en-GB", { timeZone: ZONA, hour12: false });

module.exports = { ZONA, hoyLocal, horaLocal };
