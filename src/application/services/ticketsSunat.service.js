"use strict";
/**
 * CONSULTA DE TICKETS ASÍNCRONOS DE SUNAT (getStatus)
 *
 * La Comunicación de Baja (RA) y el Resumen Diario (RC) se envían con
 * sendSummary: SUNAT devuelve un ticket y el resultado (CDR) se obtiene
 * consultándolo después. Lo usan el endpoint manual de cada uno y el
 * vigilante SUNAT del worker, que los consulta solo.
 *
 * Reglas comunes:
 * - El CDR (ZIP) se guarda en storage/cdr siempre que SUNAT lo envía.
 * - Nunca se asume aceptado: CDR ausente o ilegible → estado "ER" (se puede
 *   volver a consultar); 98 → sigue "PE".
 *
 * @returns {{ httpStatus: number, body: object, final: boolean }}
 *          final = true si el ticket quedó resuelto (PR/RR).
 */
const { Op } = require("sequelize");
const sequelize = require("../../infrastructure/database/database");
const Comprobante = require("../../infrastructure/database/models/facturacion/comprobante");
const Emisor = require("../../infrastructure/database/models/facturacion/emisor");
const ComunicacionBaja = require("../../infrastructure/database/models/facturacion/comunicacionbaja");
const ComunicacionBajaDetalle = require("../../infrastructure/database/models/facturacion/comunicacionbajadetalle");
const EnvioResumen = require("../../infrastructure/database/models/facturacion/envioresumen");
const EnvioResumenDetalle = require("../../infrastructure/database/models/facturacion/envioresumendetalle");
require("../../infrastructure/database/models/facturacion/asociation");
const sunatClient = require("../../infrastructure/external_services/sunat/sunatClient");
const cdrParser = require("../../infrastructure/external_services/sunat/cdrParser");
const storageHelper = require("../../infrastructure/external_services/sunat/storageHelper");
const { registrar } = require("./auditoria.service");

const mensajeCdr = (cdr) => String(cdr.description + (cdr.notes.length ? " | " + cdr.notes.join(" | ") : "")).substring(0, 500);

/**
 * Devuelve los comprobantes de una baja a su estado anterior (la baja falló o
 * SUNAT la rechazó: el comprobante sigue vigente).
 */
async function revertirComprobantes(detalles, transaction) {
  for (const det of detalles) {
    await Comprobante.update(
      { estado_sunat: det.estado_previo || "ACEPTADO" },
      { where: { id: det.comprobante_id, estado_sunat: "EN_BAJA" }, transaction }
    );
  }
}

/**
 * Comunicación de Baja:
 *   - CDR con ResponseCode 0 → comprobantes ANULADO, baja PR (procesada).
 *   - CDR de rechazo         → comprobantes vuelven a su estado previo, baja RR.
 * @param {number} bajaId
 * @param {object|null} req  petición (para la bitácora); null = vigilante automático
 */
async function consultarBaja(bajaId, req = null) {
  const baja = await ComunicacionBaja.findByPk(bajaId, {
    include: [{ model: Emisor }, { model: ComunicacionBajaDetalle }],
  });
  if (!baja) return { httpStatus: 404, final: false, body: { message: "Comunicación de Baja no encontrada" } };
  if (["PR", "RR"].includes(baja.estado_ticket)) {
    return {
      httpStatus: 200, final: true,
      body: {
        message: baja.estado_ticket === "PR" ? "Baja ya procesada" : "Baja rechazada por SUNAT",
        estado_ticket: baja.estado_ticket, codigo_sunat: baja.codigo_sunat, mensaje_sunat: baja.mensaje_sunat,
      },
    };
  }
  if (!baja.ticket) {
    return { httpStatus: 409, final: false, body: { message: "La baja no tiene ticket (no se envió)", estado_ticket: baja.estado_ticket } };
  }

  const status = await sunatClient.getStatus(baja.ticket, baja.Emisor);
  if (status.statusCode === "98") {
    return { httpStatus: 200, final: false, body: { estado_ticket: "PE", message: "SUNAT aún procesando. Reintente pronto." } };
  }
  if (!status.content) {
    await baja.update({ estado_ticket: "ER", codigo_sunat: status.statusCode, mensaje_sunat: "SUNAT no devolvió CDR" });
    return { httpStatus: 200, final: false, body: { estado_ticket: "ER", statusCode: status.statusCode, message: "SUNAT no devolvió CDR; vuelva a consultar" } };
  }

  storageHelper.saveCdr(baja.nombre_xml, status.content);
  let cdr;
  try {
    cdr = cdrParser.parseCdr(status.content);
  } catch (parseErr) {
    await baja.update({
      estado_ticket: "ER",
      codigo_sunat: status.statusCode,
      mensaje_sunat: `CDR guardado pero ilegible: ${parseErr.message}`.substring(0, 500),
    });
    return { httpStatus: 200, final: false, body: { estado_ticket: "ER", message: "No se pudo leer el CDR; los comprobantes siguen en baja pendiente" } };
  }

  const aceptada = cdr.responseCode === "0";
  await sequelize.transaction(async (transaction) => {
    if (aceptada) {
      await Comprobante.update(
        { estado_sunat: "ANULADO" },
        { where: { id: { [Op.in]: baja.ComunicacionBajaDetalles.map((d) => d.comprobante_id) } }, transaction }
      );
    } else {
      await revertirComprobantes(baja.ComunicacionBajaDetalles, transaction);
    }
    await baja.update({ estado_ticket: aceptada ? "PR" : "RR", codigo_sunat: cdr.responseCode, mensaje_sunat: mensajeCdr(cdr) }, { transaction });
  });

  registrar(req, aceptada ? "baja_aceptada" : "baja_rechazada", {
    usuario: req ? undefined : { usuario: "vigilante-sunat" },
    entidad: "ComunicacionBaja",
    entidad_id: baja.id,
    despues: { codigo_sunat: cdr.responseCode, comprobantes: baja.ComunicacionBajaDetalles.map((d) => d.comprobante_id) },
  });

  return {
    httpStatus: 200, final: true,
    body: {
      estado_ticket: aceptada ? "PR" : "RR",
      codigo_sunat: cdr.responseCode,
      mensaje_sunat: cdr.description,
      comprobantes: baja.ComunicacionBajaDetalles.length,
      resultado: aceptada ? "anulados" : "baja rechazada: comprobantes vigentes",
    },
  };
}

/**
 * Resumen Diario: aplica el resultado del CDR a todas las boletas incluidas.
 * Aceptado → PR; rechazado → RR (antes quedaba PR aunque SUNAT lo rechazara).
 */
async function consultarResumen(envioId, req = null) {
  const envio = await EnvioResumen.findByPk(envioId, {
    include: [{ model: Emisor }, { model: EnvioResumenDetalle }],
  });
  if (!envio) return { httpStatus: 404, final: false, body: { message: "Resumen no encontrado" } };
  if (!envio.ticket) return { httpStatus: 400, final: false, body: { message: "No hay ticket para consultar" } };
  if (["PR", "RR"].includes(envio.estado_ticket)) {
    return {
      httpStatus: 200, final: true,
      body: { message: "Resumen Diario ya fue procesado", estado_ticket: envio.estado_ticket, codigo_sunat: envio.codigo_sunat, mensaje_sunat: envio.mensaje_sunat },
    };
  }

  const status = await sunatClient.getStatus(envio.ticket, envio.Emisor);
  if (status.statusCode === "98") {
    return { httpStatus: 200, final: false, body: { estado_ticket: "PE", message: "SUNAT aún está procesando el Resumen Diario. Reintente en unos segundos.", statusCode: status.statusCode } };
  }
  if (!status.content) {
    await envio.update({ estado_ticket: "ER", codigo_sunat: status.statusCode });
    return { httpStatus: 200, final: false, body: { estado_ticket: "ER", statusCode: status.statusCode, message: "SUNAT retornó error al procesar el Resumen Diario" } };
  }

  storageHelper.saveCdr(envio.nombrexml, status.content);
  let cdr;
  try {
    cdr = cdrParser.parseCdr(status.content);
  } catch (parseErr) {
    await envio.update({ estado_ticket: "ER", mensaje_sunat: `CDR ilegible: ${parseErr.message}`.substring(0, 500) });
    return { httpStatus: 200, final: false, body: { estado_ticket: "ER", message: "CDR guardado pero ilegible; vuelva a consultar" } };
  }

  const estado = cdr.accepted ? "PR" : "RR";
  await sequelize.transaction(async (transaction) => {
    await Comprobante.update(
      { estado_sunat: cdr.accepted ? "ACEPTADO" : "RECHAZADO", codigo_sunat: cdr.responseCode, mensaje_sunat: cdr.description, hash_cpe: cdr.digestValue },
      { where: { id: { [Op.in]: envio.EnvioResumenDetalles.map((d) => d.comprobante_id) } }, transaction }
    );
    await envio.update({ estado_ticket: estado, codigo_sunat: cdr.responseCode, mensaje_sunat: mensajeCdr(cdr) }, { transaction });
  });

  registrar(req, cdr.accepted ? "resumen_aceptado" : "resumen_rechazado", {
    usuario: req ? undefined : { usuario: "vigilante-sunat" },
    entidad: "EnvioResumen",
    entidad_id: envio.id,
    despues: { codigo_sunat: cdr.responseCode, boletas: envio.EnvioResumenDetalles.length },
  });

  return {
    httpStatus: 200, final: true,
    body: { estado_ticket: estado, codigo_sunat: cdr.responseCode, mensaje_sunat: cdr.description, boletas_actualizadas: envio.EnvioResumenDetalles.length },
  };
}

module.exports = { consultarBaja, consultarResumen, revertirComprobantes };
