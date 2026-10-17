'use strict';
/**
 * WORKER DE GUÍAS DE REMISIÓN (cola "sunat-guia")
 *
 * Consulta el ticket REST de una guía enviada (estado EN) hasta obtener el
 * resultado de SUNAT:
 *   codRespuesta "0"  → AC (aceptada), CDR guardado en storage/cdr
 *   codRespuesta "99" → RR (rechazada), con el error de SUNAT y el CDR si lo hay
 *   codRespuesta "98" → en proceso: se lanza error y BullMQ reintenta con backoff
 *
 * Antes la guía se marcaba "AC" apenas llegaba el ticket, sin saber si SUNAT
 * la aceptaba, y nunca se descargaba su CDR.
 */
const { Worker } = require('bullmq');
const redis          = require('../infrastructure/config/redis');
const GuiaRemision   = require('../infrastructure/database/models/facturacion/guiaremision');
const Emisor         = require('../infrastructure/database/models/facturacion/emisor');
const sunatRestClient = require('../infrastructure/external_services/sunat/sunatRestClient');
const cdrParser      = require('../infrastructure/external_services/sunat/cdrParser');
const storageHelper  = require('../infrastructure/external_services/sunat/storageHelper');
require('../infrastructure/database/models/facturacion/asociation');

const recortar = (txt, n = 500) => String(txt ?? '').substring(0, n);

const worker = new Worker('sunat-guia', async (job) => {
  const { guia_id } = job.data;
  const guia = await GuiaRemision.findByPk(guia_id, { include: [Emisor] });

  if (!guia) return console.warn(`[GuiaWorker] Guía ${guia_id} no encontrada. Descartando.`);
  if (guia.estado_sunat !== 'EN' || !guia.ticket) {
    return console.log(`[GuiaWorker] Guía ${guia_id} en estado ${guia.estado_sunat}; nada que consultar.`);
  }

  const r = await sunatRestClient.getTicketStatus(guia.ticket, guia.Emisor);
  const cod = String(r?.codRespuesta ?? '');

  if (cod === '98') {
    throw new Error(`Ticket ${guia.ticket} aún en proceso en SUNAT (98)`);
  }

  // El CDR puede venir tanto en la aceptación como en el rechazo.
  let cdr = null;
  if (r?.arcCdr) {
    storageHelper.saveCdr(guia.nombre_xml, r.arcCdr);
    try {
      cdr = cdrParser.parseCdr(r.arcCdr);
    } catch (e) {
      console.warn(`[GuiaWorker] CDR de la guía ${guia_id} guardado pero no se pudo leer: ${e.message}`);
    }
  }

  if (cod === '0') {
    const notas = cdr?.notes?.length ? ' | ' + cdr.notes.join(' | ') : '';
    await guia.update({
      estado_sunat:  'AC',
      codigo_sunat:  cdr?.responseCode || '0',
      mensaje_sunat: recortar((cdr?.description || 'Aceptada por SUNAT') + notas),
      hash_cpe:      cdr?.digestValue || guia.hash_cpe,
    });
    return console.log(`[GuiaWorker] Guía ${guia_id} → AC`);
  }

  if (cod === '99') {
    const err = r?.error || {};
    await guia.update({
      estado_sunat:  'RR',
      codigo_sunat:  recortar(err.numError || cdr?.responseCode || '99', 10),
      mensaje_sunat: recortar(err.desError || cdr?.description || 'Rechazada por SUNAT'),
    });
    return console.warn(`[GuiaWorker] Guía ${guia_id} → RR (${err.numError || cdr?.responseCode})`);
  }

  throw new Error(`Respuesta inesperada de SUNAT para el ticket ${guia.ticket}: codRespuesta=${cod || '(vacío)'}`);
}, { connection: redis, concurrency: 2 });

worker.on('failed', (job, err) => {
  console.warn(`[GuiaWorker] Job ${job?.id} intento ${job?.attemptsMade}/${job?.opts?.attempts}: ${err.message}`);
});
worker.on('error', (err) => console.error('[GuiaWorker] Error interno:', err.message));

module.exports = worker;
