'use strict';

const { Worker } = require('bullmq');
const redis        = require('../infrastructure/config/redis');
const Comprobante  = require('../infrastructure/database/models/facturacion/comprobante');
const Emisor       = require('../infrastructure/database/models/facturacion/emisor');
const Serie        = require('../infrastructure/database/models/facturacion/serie');
const sunatClient  = require('../infrastructure/external_services/sunat/sunatClient');
const cdrParser    = require('../infrastructure/external_services/sunat/cdrParser');
const storageHelper = require('../infrastructure/external_services/sunat/storageHelper');

require('../infrastructure/database/models/facturacion/asociation');

const PLAZO_DIAS = 3;

/**
 * Determina el estado SUNAT a partir del CDR parseado.
 * - responseCode "0"            → ACEPTADO
 * - responseCode 2000–3999      → OBSERVADO (válido con notas)
 * - cualquier otro              → RECHAZADO
 */
function resolverEstadoCdr(cdr) {
  const code = parseInt(cdr.responseCode, 10);
  if (cdr.responseCode === '0') return 'ACEPTADO';
  if (code >= 2000 && code <= 3999) return 'OBSERVADO';
  return 'RECHAZADO';
}

/**
 * Extrae código y mensaje legible de un error SOAP de SUNAT.
 */
function extraerErrorSoap(err) {
  const fault       = err.root?.Envelope?.Body?.Fault;
  const faultDetail = fault?.detail?.fault;

  if (faultDetail?.faultCode || faultDetail?.faultcode) {
    return {
      codigo:  String(faultDetail.faultCode  || faultDetail.faultcode).substring(0, 10),
      mensaje: String(faultDetail.faultString || faultDetail.faultstring || err.message).substring(0, 500),
    };
  }
  if (fault?.faultcode || fault?.faultCode) {
    return {
      codigo:  String(fault.faultcode || fault.faultCode).substring(0, 10),
      mensaje: String(fault.faultstring || fault.faultString || fault.detail || err.message).substring(0, 500),
    };
  }
  const codeMatch = err.message?.match(/(\d{3,4})/);
  return {
    codigo:  codeMatch ? codeMatch[1] : 'ERR_RED',
    mensaje: String(err.message || 'Error de red').substring(0, 500),
  };
}

const worker = new Worker('sunat-envio', async (job) => {
  const { comprobante_id, nombre_xml } = job.data;
  console.log(`[Worker] Procesando comprobante ${comprobante_id} (intento ${job.attemptsMade + 1})`);

  // 1. Cargar comprobante con emisor y serie
  const comprobante = await Comprobante.findByPk(comprobante_id, {
    include: [Emisor, Serie],
  });

  if (!comprobante) {
    // No existe → descartar job sin reintentar
    console.warn(`[Worker] Comprobante ${comprobante_id} no encontrado. Descartando.`);
    return;
  }

  // 2. Ya fue aceptado por otra vía → no procesar
  if (comprobante.estado_sunat === 'ACEPTADO') {
    console.log(`[Worker] Comprobante ${comprobante_id} ya ACEPTADO. Omitiendo.`);
    return;
  }

  // 3. Verificar plazo de 3 días
  const diasDesdeEmision = (Date.now() - new Date(comprobante.fecha_emision).getTime()) / 86_400_000;
  if (diasDesdeEmision > PLAZO_DIAS) {
    await comprobante.update({ estado_sunat: 'FUERA_PLAZO' });
    console.warn(`[Worker] Comprobante ${comprobante_id} FUERA_PLAZO (${Math.floor(diasDesdeEmision)} días).`);
    return; // sin reintento
  }

  // 4. Verificar que el XML firmado existe en disco
  const archivoXml = nombre_xml || comprobante.xml_path || comprobante.nombre_xml;
  if (!archivoXml || !storageHelper.existsXml(archivoXml)) {
    console.error(`[Worker] XML no encontrado para comprobante ${comprobante_id}: ${archivoXml}`);
    await comprobante.update({ estado_sunat: 'ERROR_RED', mensaje_sunat: 'XML firmado no encontrado en disco' });
    throw new Error('XML firmado no encontrado — reencolar después de regenerar');
  }

  // 5. Marcar como ENVIANDO
  await comprobante.update({ estado_sunat: 'ENVIANDO', enviado_at: new Date() });

  // 6. Leer XML y enviar a SUNAT
  const xmlFirmado = storageHelper.readXml(archivoXml);
  const xmlBuffer  = Buffer.from(xmlFirmado, 'utf8');

  let cdrBase64;
  try {
    cdrBase64 = await sunatClient.sendBill(xmlBuffer, archivoXml, comprobante.Emisor);
  } catch (soapErr) {
    const { codigo, mensaje } = extraerErrorSoap(soapErr);
    console.error(`[Worker] SOAP error comprobante ${comprobante_id}: ${codigo} - ${mensaje}`);

    await comprobante.update({
      estado_sunat:    'ERROR_RED',
      codigo_sunat:    codigo,
      cdr_code:        codigo,
      mensaje_sunat:   mensaje,
      intentos_envio:  (comprobante.intentos_envio || 0) + 1,
    });

    // Relanzar para que BullMQ aplique backoff exponencial
    throw soapErr;
  }

  // 7. Sin CDR en la respuesta → reintentar
  if (!cdrBase64) {
    await comprobante.update({
      estado_sunat:   'SIN_CDR',
      mensaje_sunat:  'SUNAT no retornó CDR en la respuesta',
      intentos_envio: (comprobante.intentos_envio || 0) + 1,
    });
    throw new Error('SIN_CDR — SUNAT no retornó applicationResponse');
  }

  // 8. Guardar CDR en disco
  storageHelper.saveCdr(archivoXml, cdrBase64);

  // 9. Parsear CDR
  let cdr;
  try {
    cdr = cdrParser.parseCdr(cdrBase64);
  } catch (parseErr) {
    console.error(`[Worker] Error al parsear CDR comprobante ${comprobante_id}:`, parseErr.message);
    await comprobante.update({
      estado_sunat:   'SIN_CDR',
      cdr_xml:        cdrBase64,
      mensaje_sunat:  'Error al parsear CDR: ' + parseErr.message,
      intentos_envio: (comprobante.intentos_envio || 0) + 1,
    });
    throw parseErr;
  }

  // 10. Determinar estado final
  const estadoFinal = resolverEstadoCdr(cdr);
  const mensajeFinal = cdr.description + (cdr.notes.length ? ' | ' + cdr.notes.join(' | ') : '');

  await comprobante.update({
    estado_sunat:      estadoFinal,
    // canónicos
    cdr_code:          cdr.responseCode,
    cdr_xml:           cdr.xmlContent,
    hash:              cdr.digestValue,
    enviado_at:        new Date(),
    // legacy (compatibilidad)
    codigo_sunat:      cdr.responseCode,
    mensaje_sunat:     mensajeFinal,
    hash_cpe:          cdr.digestValue,
    fecha_envio_sunat: new Date(),
    intentos_envio:    (comprobante.intentos_envio || 0) + 1,
  });

  // 11. Incrementar correlativo de serie solo si ACEPTADO
  if (estadoFinal === 'ACEPTADO' && comprobante.Serie) {
    await Serie.update(
      { correlativo: comprobante.correlativo + 1 },
      { where: { id: comprobante.serie_id } }
    );
  }

  console.log(`[Worker] Comprobante ${comprobante_id} → ${estadoFinal} (CDR: ${cdr.responseCode})`);
}, {
  connection: redis,
  concurrency: 3,
});

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completado`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job.id} falló (intento ${job.attemptsMade}/${job.opts.attempts}): ${err.message}`);
});

worker.on('error', (err) => {
  console.error('[Worker] Error interno:', err.message);
});

module.exports = worker;
