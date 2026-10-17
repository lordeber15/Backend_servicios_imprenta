'use strict';

const { Queue } = require('bullmq');
const redis = require('../config/redis');

const sunatQueue = new Queue('sunat-envio', {
  connection: redis,
  defaultJobOptions: {
    attempts: parseInt(process.env.SUNAT_MAX_REINTENTOS) || 5,
    backoff: {
      type: 'exponential',
      delay: parseInt(process.env.SUNAT_BACKOFF_DELAY) || 60_000,
    },
    removeOnComplete: { count: 500 },
    removeOnFail:     { count: 200 },
  },
});

/**
 * Encola el envío de un comprobante a SUNAT.
 * Usa jobId único para evitar duplicados si se llama más de una vez.
 *
 * @param {number} comprobante_id
 * @param {string} nombre_xml - nombre del archivo sin extensión
 * @param {object} [opts] - opciones adicionales para el job
 */
async function encolarEnvio(comprobante_id, nombre_xml, opts = {}) {
  const jobId = `comprobante-${comprobante_id}`;

  // Si ya hay un job pendiente/activo para este comprobante, no duplicar
  const existing = await sunatQueue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (['waiting', 'active', 'delayed'].includes(state)) {
      return existing;
    }
    // Si falló o completó, remover para poder encolar de nuevo
    await existing.remove();
  }

  return sunatQueue.add(
    'enviar-comprobante',
    { comprobante_id, nombre_xml },
    { jobId, ...opts }
  );
}

// ── Guías de remisión: consulta del ticket REST hasta obtener el CDR ────────
// La API de guías es asíncrona: el envío devuelve un ticket y el resultado
// (aceptada/rechazada + CDR) se obtiene consultándolo. Mientras SUNAT
// responde "98" (en proceso) el job falla y BullMQ reintenta con backoff.
const guiaQueue = new Queue('sunat-guia', {
  connection: redis,
  defaultJobOptions: {
    attempts: 10,
    backoff: { type: 'exponential', delay: 15_000 }, // 15s, 30s, 1m, 2m… (~4 h en total)
    removeOnComplete: { count: 500 },
    removeOnFail:     { count: 200 },
  },
});

/** Encola (sin duplicar) la consulta del ticket de una guía. */
async function encolarConsultaGuia(guia_id, opts = {}) {
  const jobId = `guia-${guia_id}`;
  const existing = await guiaQueue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (['waiting', 'active', 'delayed'].includes(state)) return existing;
    await existing.remove();
  }
  return guiaQueue.add('consultar-ticket-guia', { guia_id }, { jobId, delay: 5_000, ...opts });
}

module.exports = { sunatQueue, encolarEnvio, guiaQueue, encolarConsultaGuia };
