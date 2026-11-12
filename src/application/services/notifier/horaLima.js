// Perú usa UTC-5 todo el año (sin horario de verano).
const LIMA_TZ = "America/Lima";
const DESFASE_LIMA_MS = 5 * 60 * 60 * 1000;

/** Fecha de hoy en Lima como YYYY-MM-DD. */
function hoyEnLima(ahora = new Date()) {
  return new Date(ahora.getTime() - DESFASE_LIMA_MS).toISOString().slice(0, 10);
}

/** Rango UTC [desde, hasta) que cubre el día YYYY-MM-DD de Lima. */
function rangoDiaLima(fecha) {
  const [y, m, d] = fecha.split("-").map(Number);
  const desde = new Date(Date.UTC(y, m - 1, d) + DESFASE_LIMA_MS);
  return { desde, hasta: new Date(desde.getTime() + 24 * 60 * 60 * 1000) };
}

const formato = new Intl.DateTimeFormat("es-PE", {
  timeZone: LIMA_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function formatearLima(fecha) {
  return formato.format(fecha);
}

module.exports = { LIMA_TZ, hoyEnLima, rangoDiaLima, formatearLima };
