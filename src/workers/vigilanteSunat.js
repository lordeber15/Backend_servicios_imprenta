'use strict';
/**
 * VIGILANTE SUNAT (cola "sunat-vigilante", cada 15 min)
 *
 * Nada debe quedar "en el limbo" esperando que alguien apriete un botón:
 *  1. Comprobantes sin resolver (GENERADO/FIRMADO/ERROR_RED/SIN_CDR, o
 *     ENVIANDO atascado) cuyo job ya no está en la cola → se reencolan
 *     (regenerando el XML si falta en disco). Tope: VIGILANTE_MAX_INTENTOS.
 *  2. Los que pasaron el plazo SUNAT → FUERA_PLAZO (ver plazosSunat).
 *  3. Bajas (RA) y resúmenes (RC) con ticket pendiente → se consulta el ticket.
 *  4. Guías enviadas (EN) sin consulta en curso → se reencola la consulta.
 *  5. Certificado por vencer → aviso en el log.
 * El resultado de la última pasada queda en Redis para GET /sunat/pendientes.
 *
 * Además publica el "latido" del worker (Redis y /tmp/latido) cada 30 s: lo
 * usan el healthcheck del contenedor y el contador del dashboard.
 */
const fs = require('fs');
const { Op } = require('sequelize');
const { Queue, Worker } = require('bullmq');
const redis = require('../infrastructure/config/redis');
const Comprobante = require('../infrastructure/database/models/facturacion/comprobante');
const ComunicacionBaja = require('../infrastructure/database/models/facturacion/comunicacionbaja');
const EnvioResumen = require('../infrastructure/database/models/facturacion/envioresumen');
const GuiaRemision = require('../infrastructure/database/models/facturacion/guiaremision');
require('../infrastructure/database/models/facturacion/asociation');
const storageHelper = require('../infrastructure/external_services/sunat/storageHelper');
const { sunatQueue, guiaQueue, encolarEnvio, encolarConsultaGuia } = require('../infrastructure/queues/sunatQueue');
const { INCLUDE_XML, generarYFirmarXml } = require('../application/services/firmaComprobante');
const { consultarBaja, consultarResumen } = require('../application/services/ticketsSunat.service');
const { estadoCertificado } = require('../application/services/certificado.service');
const { vencido } = require('../application/plazosSunat');

const CLAVE_LATIDO = 'imprenta:worker:latido';
const CLAVE_RESULTADO = 'imprenta:vigilante:ultimo';
const ARCHIVO_LATIDO = '/tmp/latido';
const CADA_MS = Number(process.env.VIGILANTE_CADA_MIN || 15) * 60_000;
const MAX_INTENTOS = Number(process.env.VIGILANTE_MAX_INTENTOS || 20);
const ESTADOS_SIN_RESOLVER = ['GENERADO', 'FIRMADO', 'ERROR_RED', 'SIN_CDR', 'ENVIANDO'];
const ENVIANDO_ATASCADO_MS = 30 * 60_000;
const EN_COLA = ['waiting', 'active', 'delayed', 'prioritized', 'waiting-children'];

const vigilanteQueue = new Queue('sunat-vigilante', {
  connection: redis,
  defaultJobOptions: { removeOnComplete: { count: 50 }, removeOnFail: { count: 50 }, attempts: 1 },
});

async function enCola(queue, jobId) {
  const job = await queue.getJob(jobId);
  return job ? EN_COLA.includes(await job.getState()) : false;
}

async function revisarComprobantes(r) {
  const lista = await Comprobante.findAll({
    where: { estado_sunat: ESTADOS_SIN_RESOLVER, tipo_comprobante_id: ['01', '03', '07', '08'] },
    attributes: ['id', 'estado_sunat', 'fecha_emision', 'tipo_comprobante_id', 'serie', 'correlativo', 'nombre_xml', 'xml_path', 'intentos_envio', 'enviado_at'],
    order: [['id', 'ASC']],
    limit: 500,
  });

  for (const c of lista) {
    try {
      if (vencido(c.fecha_emision, c.tipo_comprobante_id, c.serie)) {
        await c.update({ estado_sunat: 'FUERA_PLAZO', es_terminal: true, mensaje_sunat: 'No se envió dentro del plazo de SUNAT' });
        r.fuera_plazo.push(`${c.serie}-${c.correlativo}`);
        continue;
      }
      if (await enCola(sunatQueue, `comprobante-${c.id}`)) continue;
      if (c.estado_sunat === 'ENVIANDO' && c.enviado_at && Date.now() - new Date(c.enviado_at) < ENVIANDO_ATASCADO_MS) continue;
      if ((c.intentos_envio || 0) >= MAX_INTENTOS) { r.sin_reintento.push(`${c.serie}-${c.correlativo}`); continue; }

      let archivo = c.nombre_xml || c.xml_path;
      if (!archivo || !storageHelper.existsXml(archivo)) {
        archivo = await generarYFirmarXml(await Comprobante.findByPk(c.id, { include: INCLUDE_XML }));
        r.regenerados += 1;
      }
      await encolarEnvio(c.id, archivo);
      r.reencolados.push(`${c.serie}-${c.correlativo}`);
    } catch (err) {
      r.errores.push(`comprobante ${c.id}: ${err.message}`.slice(0, 200));
    }
  }
}

async function revisarTickets(r) {
  const desde = new Date(Date.now() - 30 * 86_400_000);
  const bajas = await ComunicacionBaja.findAll({
    where: { estado_ticket: ['PE', 'ER'], ticket: { [Op.ne]: null }, fecha_envio: { [Op.gte]: desde } },
    attributes: ['id'], limit: 50,
  });
  for (const b of bajas) {
    try {
      const res = await consultarBaja(b.id, null);
      if (res.final) r.bajas_resueltas += 1;
    } catch (err) { r.errores.push(`baja ${b.id}: ${err.message}`.slice(0, 200)); }
  }
  const resumenes = await EnvioResumen.findAll({
    where: { estado_ticket: ['PE', 'ER'], ticket: { [Op.ne]: null } }, attributes: ['id'], limit: 50,
  });
  for (const e of resumenes) {
    try {
      const res = await consultarResumen(e.id, null);
      if (res.final) r.resumenes_resueltos += 1;
    } catch (err) { r.errores.push(`resumen ${e.id}: ${err.message}`.slice(0, 200)); }
  }
  const guias = await GuiaRemision.findAll({
    where: { estado_sunat: 'EN', ticket: { [Op.ne]: null } }, attributes: ['id'], limit: 100,
  });
  for (const g of guias) {
    try {
      if (await enCola(guiaQueue, `guia-${g.id}`)) continue;
      await encolarConsultaGuia(g.id, { delay: 0 });
      r.guias_reconsultadas += 1;
    } catch (err) { r.errores.push(`guía ${g.id}: ${err.message}`.slice(0, 200)); }
  }
}

/** Una pasada completa. Exportada para las pruebas. */
async function revisar() {
  const r = {
    inicio: new Date().toISOString(), reencolados: [], regenerados: 0, fuera_plazo: [], sin_reintento: [],
    bajas_resueltas: 0, resumenes_resueltos: 0, guias_reconsultadas: 0, errores: [],
  };
  await revisarComprobantes(r);
  await revisarTickets(r);
  r.certificado = estadoCertificado();
  r.fin = new Date().toISOString();

  if (r.certificado.estado !== 'ok') console.warn(`[Vigilante] Certificado: ${r.certificado.estado} (${r.certificado.dias_restantes ?? '?'} días)`);
  if (r.fuera_plazo.length) console.warn(`[Vigilante] FUERA_PLAZO: ${r.fuera_plazo.join(', ')}`);
  if (r.errores.length) console.error(`[Vigilante] Errores: ${r.errores.join(' | ')}`);
  console.log(`[Vigilante] reencolados=${r.reencolados.length} regenerados=${r.regenerados} fuera_plazo=${r.fuera_plazo.length} ` +
    `bajas=${r.bajas_resueltas} resúmenes=${r.resumenes_resueltos} guías=${r.guias_reconsultadas}`);
  await redis.set(CLAVE_RESULTADO, JSON.stringify(r), 'EX', 24 * 3600);
  return r;
}

function latir() {
  redis.set(CLAVE_LATIDO, String(Date.now()), 'EX', 120).catch(() => {});
  try { fs.writeFileSync(ARCHIVO_LATIDO, String(Date.now())); } catch { /* sin /tmp: solo Redis */ }
}

/** Arranca el vigilante (worker + programación) y el latido. */
async function iniciar() {
  const worker = new Worker('sunat-vigilante', () => revisar(), { connection: redis, concurrency: 1 });
  worker.on('failed', (_job, err) => console.error('[Vigilante] Pasada fallida:', err.message));
  // Idempotente: reiniciar el worker no duplica la programación.
  await vigilanteQueue.upsertJobScheduler('vigilante-sunat', { every: CADA_MS, immediately: true }, { name: 'revisar' });
  latir();
  const timer = setInterval(latir, 30_000);
  return { close: async () => { clearInterval(timer); await worker.close(); } };
}

module.exports = { iniciar, revisar, CLAVE_LATIDO, CLAVE_RESULTADO };
