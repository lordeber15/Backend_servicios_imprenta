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

// Códigos SUNAT que no tienen sentido reintentar (el XML está rechazado
// definitivamente o ya fue registrado en SUNAT con datos que no vamos a cambiar).
const CODIGOS_TERMINAL = new Set([
  '1034', // Numeración ya registrada
  '0111', // Comprobante dado de baja
  '2108', // Tipo de cambio no válido
  '3101', // Importe de tributo inválido
]);

function resolverEstadoCdr(cdr) {
  const code = parseInt(cdr.responseCode, 10);
  if (cdr.responseCode === '0') return 'ACEPTADO';
  if (code >= 2000 && code <= 3999) return 'OBSERVADO';
  return 'RECHAZADO';
}

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

// Extrae el número de ticket del mensaje de error 1033.
// Ejemplo: "ticket: 202620826487610 error: El comprobante..."
function extraerTicket(mensaje) {
  const m = mensaje?.match(/ticket[:\s]+(\d+)/i);
  return m ? m[1] : null;
}

// Guarda el CDR parseado en el comprobante y actualiza serie si es necesario.
async function aplicarCdr(comprobante, cdr) {
  const estadoFinal  = resolverEstadoCdr(cdr);
  const mensajeFinal = cdr.description + (cdr.notes.length ? ' | ' + cdr.notes.join(' | ') : '');

  await comprobante.update({
    estado_sunat:      estadoFinal,
    cdr_code:          cdr.responseCode,
    cdr_xml:           cdr.xmlContent,
    hash:              cdr.digestValue,
    enviado_at:        new Date(),
    codigo_sunat:      cdr.responseCode,
    mensaje_sunat:     mensajeFinal,
    hash_cpe:          cdr.digestValue,
    fecha_envio_sunat: new Date(),
    intentos_envio:    (comprobante.intentos_envio || 0) + 1,
  });

  if (estadoFinal === 'ACEPTADO' && comprobante.Serie) {
    await Serie.update(
      { correlativo: comprobante.correlativo + 1 },
      { where: { id: comprobante.serie_id } }
    );
  }

  console.log(`[Worker] Comprobante ${comprobante.id} → ${estadoFinal} (CDR: ${cdr.responseCode})`);
  return estadoFinal;
}

const worker = new Worker('sunat-envio', async (job) => {
  const { comprobante_id, nombre_xml } = job.data;
  console.log(`[Worker] Procesando comprobante ${comprobante_id} (intento ${job.attemptsMade + 1})`);

  // 1. Cargar comprobante con emisor y serie
  const comprobante = await Comprobante.findByPk(comprobante_id, {
    include: [Emisor, Serie],
  });

  if (!comprobante) {
    console.warn(`[Worker] Comprobante ${comprobante_id} no encontrado. Descartando.`);
    return;
  }

  if (comprobante.estado_sunat === 'ACEPTADO') {
    console.log(`[Worker] Comprobante ${comprobante_id} ya ACEPTADO. Omitiendo.`);
    return;
  }

  // 2. Verificar plazo de 3 días
  const diasDesdeEmision = (Date.now() - new Date(comprobante.fecha_emision).getTime()) / 86_400_000;
  if (diasDesdeEmision > PLAZO_DIAS) {
    await comprobante.update({ estado_sunat: 'FUERA_PLAZO' });
    console.warn(`[Worker] Comprobante ${comprobante_id} FUERA_PLAZO (${Math.floor(diasDesdeEmision)} días).`);
    return;
  }

  // 3. Verificar que el XML firmado existe en disco
  const archivoXml = nombre_xml || comprobante.xml_path || comprobante.nombre_xml;
  if (!archivoXml || !storageHelper.existsXml(archivoXml)) {
    console.error(`[Worker] XML no encontrado para comprobante ${comprobante_id}: ${archivoXml}`);
    await comprobante.update({ estado_sunat: 'ERROR_RED', mensaje_sunat: 'XML firmado no encontrado en disco' });
    throw new Error('XML firmado no encontrado — reencolar después de regenerar');
  }

  // 4. Marcar como ENVIANDO
  await comprobante.update({ estado_sunat: 'ENVIANDO', enviado_at: new Date() });

  // 5. Leer XML y enviar a SUNAT
  const xmlFirmado = storageHelper.readXml(archivoXml);
  const xmlBuffer  = Buffer.from(xmlFirmado, 'utf8');

  let cdrBase64;
  try {
    cdrBase64 = await sunatClient.sendBill(xmlBuffer, archivoXml, comprobante.Emisor);
  } catch (soapErr) {
    const { codigo, mensaje } = extraerErrorSoap(soapErr);
    const codigoNumerico = codigo.replace(/[^\d]/g, '');

    console.error('═══════════════════════════════════════════════════════');
    console.error(`[Worker] SOAP ERROR — Comprobante ${comprobante_id} (intento ${job.attemptsMade + 1})`);
    console.error(`  Archivo XML : ${archivoXml}`);
    console.error(`  Emisor RUC  : ${comprobante.Emisor?.ruc}`);
    console.error(`  Endpoint    : ${process.env.SUNAT_WS_FACTURAS}`);
    console.error(`  Código      : ${codigo} (numérico: ${codigoNumerico})`);
    console.error(`  Mensaje     : ${mensaje}`);
    if (soapErr.body)  console.error(`  SOAP body   :\n${soapErr.body}`);
    if (soapErr.root)  console.error(`  SOAP root   :`, JSON.stringify(soapErr.root, null, 2));
    console.error('═══════════════════════════════════════════════════════');

    // ── Error 1033: documento ya registrado en SUNAT ──────────────────
    // Ocurre cuando el primer envío llegó a SUNAT pero nuestro parser del
    // CDR falló. SUNAT tiene el documento; consultamos el ticket para
    // recuperar el CDR sin reenviar el ZIP.
    if (codigoNumerico === '1033') {
      const ticket = extraerTicket(soapErr.message || mensaje);
      if (ticket) {
        console.log(`[Worker] Error 1033 — consultando ticket ${ticket} para recuperar CDR...`);
        try {
          const status = await sunatClient.getStatus(ticket, comprobante.Emisor);
          if (status.statusCode === '0' && status.content) {
            const cdr = cdrParser.parseCdr(status.content);
            await aplicarCdr(comprobante, cdr);
            console.log(`[Worker] CDR recuperado via getStatus. Comprobante ${comprobante_id} → ${resolverEstadoCdr(cdr)}`);
            return; // completado exitosamente, sin throw
          }
          if (status.statusCode === '98') {
            // SUNAT aún procesando — reintentar en 15 min
            console.log(`[Worker] Ticket ${ticket} aún en proceso (98). Reintentando en 15 min.`);
            await comprobante.update({ estado_sunat: 'ERROR_RED', mensaje_sunat: 'SUNAT en proceso (98) — reintentando' });
            const retryErr = new Error(`SUNAT en proceso — ticket ${ticket}`);
            retryErr.sunatCode = '0140'; // usa el mismo delay de 15 min
            throw retryErr;
          }
        } catch (statusErr) {
          if (statusErr.sunatCode) throw statusErr; // re-lanzar el nuestro
          console.error(`[Worker] getStatus falló para ticket ${ticket}: ${statusErr.message}`);
        }
      }
      // Sin ticket o getStatus falló → marcar RECHAZADO terminal
      await comprobante.update({
        estado_sunat:   'RECHAZADO',
        cdr_code:       codigo,
        mensaje_sunat:  mensaje,
        intentos_envio: (comprobante.intentos_envio || 0) + 1,
      });
      console.warn(`[Worker] Comprobante ${comprobante_id} → RECHAZADO (1033 sin ticket recuperable)`);
      return; // terminal, sin throw
    }

    // ── Errores terminales: no reintentar ─────────────────────────────
    if (CODIGOS_TERMINAL.has(codigoNumerico)) {
      await comprobante.update({
        estado_sunat:   'RECHAZADO',
        cdr_code:       codigo,
        mensaje_sunat:  mensaje,
        intentos_envio: (comprobante.intentos_envio || 0) + 1,
      });
      console.warn(`[Worker] Comprobante ${comprobante_id} → RECHAZADO terminal (${codigoNumerico})`);
      return; // sin throw → BullMQ no reintenta
    }

    // ── Errores Client (4xx SUNAT): validación XML, datos incorrectos ──
    // "soap-env:Client.XXXX" → son errores de nuestro XML, no de red.
    // Reintentar no ayuda sin corregir el XML.
    if (codigo.toLowerCase().includes('client.')) {
      await comprobante.update({
        estado_sunat:   'RECHAZADO',
        cdr_code:       codigo,
        mensaje_sunat:  mensaje,
        intentos_envio: (comprobante.intentos_envio || 0) + 1,
      });
      console.warn(`[Worker] Comprobante ${comprobante_id} → RECHAZADO (Client error: ${codigo})`);
      return; // sin throw → no reintentar
    }

    // ── Error 0140: "Documento igual en proceso, esperar 15 min" ───────
    // Adjuntamos el código al error para que backoffStrategy lo detecte.
    await comprobante.update({
      estado_sunat:   'ERROR_RED',
      cdr_code:       codigo,
      mensaje_sunat:  mensaje,
      intentos_envio: (comprobante.intentos_envio || 0) + 1,
    });
    const retryableErr = new Error(soapErr.message);
    retryableErr.sunatCode = codigoNumerico;
    throw retryableErr;
  }

  // 6. Sin CDR en la respuesta
  if (!cdrBase64) {
    console.error('═══════════════════════════════════════════════════════');
    console.error(`[Worker] SIN_CDR — Comprobante ${comprobante_id}`);
    console.error(`  SUNAT respondió OK pero applicationResponse es: ${JSON.stringify(cdrBase64)}`);
    console.error('═══════════════════════════════════════════════════════');
    await comprobante.update({
      estado_sunat:   'SIN_CDR',
      mensaje_sunat:  'SUNAT no retornó CDR en la respuesta',
      intentos_envio: (comprobante.intentos_envio || 0) + 1,
    });
    throw new Error('SIN_CDR — SUNAT no retornó applicationResponse');
  }

  // 7. Guardar CDR en disco
  storageHelper.saveCdr(archivoXml, cdrBase64);

  // 8. Parsear CDR
  let cdr;
  try {
    cdr = cdrParser.parseCdr(cdrBase64);
  } catch (parseErr) {
    console.error('═══════════════════════════════════════════════════════');
    console.error(`[Worker] ERROR PARSE CDR — Comprobante ${comprobante_id}`);
    console.error(`  Error: ${parseErr.message}`);
    console.error(`  CDR base64 (primeros 200): ${String(cdrBase64).substring(0, 200)}`);
    console.error('═══════════════════════════════════════════════════════');
    await comprobante.update({
      estado_sunat:   'SIN_CDR',
      cdr_xml:        String(cdrBase64).substring(0, 5000),
      mensaje_sunat:  'Error al parsear CDR: ' + parseErr.message,
      intentos_envio: (comprobante.intentos_envio || 0) + 1,
    });
    throw parseErr;
  }

  // 9. Aplicar CDR y actualizar estado final
  await aplicarCdr(comprobante, cdr);

}, {
  connection: redis,
  concurrency: 3,
  settings: {
    backoffStrategy: (attemptsMade, _type, err) => {
      // Error 0140 o "en proceso": SUNAT pide esperar 15 minutos exactos.
      if (err?.sunatCode === '0140') {
        console.log(`[Worker backoff] Código 0140 → delay fijo 15 min (intento ${attemptsMade})`);
        return 15 * 60 * 1000;
      }
      // Resto: exponencial base 15 min → 15m, 30m, 1h, 2h, 4h
      const delay = Math.pow(2, attemptsMade - 1) * (parseInt(process.env.SUNAT_BACKOFF_DELAY) || 900_000);
      console.log(`[Worker backoff] Delay exponencial intento ${attemptsMade}: ${Math.round(delay / 60000)} min`);
      return delay;
    },
  },
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
