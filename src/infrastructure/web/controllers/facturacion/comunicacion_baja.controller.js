"use strict";

const { Op } = require("sequelize");
const sequelize = require("../../../database/database");
const Comprobante = require("../../../database/models/facturacion/comprobante");
const Emisor = require("../../../database/models/facturacion/emisor");
const ComunicacionBaja = require("../../../database/models/facturacion/comunicacionbaja");
const ComunicacionBajaDetalle = require("../../../database/models/facturacion/comunicacionbajadetalle");
require("../../../database/models/facturacion/asociation");

const comunicacionBajaBuilder = require("../../../external_services/sunat/xmlBuilders/comunicacionBajaBuilder");
const xmlSigner = require("../../../external_services/sunat/xmlSigner");
const sunatClient = require("../../../external_services/sunat/sunatClient");
const cdrParser = require("../../../external_services/sunat/cdrParser");
const storageHelper = require("../../../external_services/sunat/storageHelper");
const { hoyLocal } = require("../../../utils/fecha");
const { ValidationError, NotFoundError, ConflictError } = require("../../../utils/errors");

// Solo se da de baja lo que SUNAT tiene registrado.
const ESTADOS_ANULABLES = ["ACEPTADO", "OBSERVADO"];

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
 * POST /comunicacion-baja
 * Body: {
 *   emisor_id: number,
 *   fecha_referencia: "YYYY-MM-DD",   // fecha de emisión de los comprobantes a anular
 *   comprobantes: [{ id, motivo_baja }]
 * }
 *
 * Solo para Facturas (01), NC (07) y ND (08) ya ACEPTADAS u OBSERVADAS por SUNAT.
 * Las boletas (03) se anulan a través del Resumen Diario (condicion=3).
 *
 * 1. En una transacción: valida y bloquea los comprobantes, reserva el
 *    correlativo del RA del día (bloqueo consultivo por emisor+fecha) y los
 *    marca EN_BAJA.
 * 2. Fuera de la transacción: firma y envía. Si el envío falla, revierte.
 */
const crearComunicacionBaja = async (req, res, next) => {
  try {
    const { emisor_id, fecha_referencia, comprobantes: compIds } = req.body || {};

    if (!emisor_id || !fecha_referencia || !Array.isArray(compIds) || !compIds.length) {
      throw new ValidationError("emisor_id, fecha_referencia y comprobantes[] son requeridos");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_referencia)) {
      throw new ValidationError("fecha_referencia debe tener formato YYYY-MM-DD");
    }

    const emisor = await Emisor.findByPk(emisor_id);
    if (!emisor) throw new NotFoundError("Emisor no encontrado");

    const fechaEmision = hoyLocal();

    const { baja, comprobantesData } = await sequelize.transaction(async (transaction) => {
      const comprobantesData = [];
      for (const item of compIds) {
        const c = await Comprobante.findByPk(item.id, { transaction, lock: transaction.LOCK.UPDATE });
        if (!c) throw new NotFoundError(`Comprobante id=${item.id} no encontrado`);
        if (c.emisor_id !== Number(emisor_id)) {
          throw new ValidationError(`El comprobante ${c.serie}-${c.correlativo} pertenece a otro emisor`);
        }
        if (c.tipo_comprobante_id === "03") {
          throw new ValidationError("Las boletas (03) no se anulan por Comunicación de Baja; use Resumen Diario con condición 3.");
        }
        if (!ESTADOS_ANULABLES.includes(c.estado_sunat)) {
          throw new ConflictError(
            `El comprobante ${c.serie}-${c.correlativo} no puede darse de baja en estado ${c.estado_sunat}`
          );
        }
        comprobantesData.push({
          ...c.dataValues,
          motivo_baja: String(item.motivo_baja || "Anulación por error en emisión").slice(0, 100),
        });
      }

      // Serializa la numeración del RA del día por emisor (dos bajas
      // simultáneas no pueden tomar el mismo correlativo).
      await sequelize.query("SELECT pg_advisory_xact_lock(hashtext(:clave))", {
        replacements: { clave: `RA:${emisor_id}:${fechaEmision}` },
        transaction,
      });
      const max = await ComunicacionBaja.max("correlativo", {
        where: { emisor_id, fecha_emision: fechaEmision },
        transaction,
      });
      const correlativo = (max || 0) + 1;
      const nombreArchivo = `${emisor.ruc}-RA-${fechaEmision.replace(/-/g, "")}-${correlativo}`;

      const baja = await ComunicacionBaja.create({
        emisor_id,
        correlativo,
        fecha_emision: fechaEmision,
        fecha_referencia,
        nombre_xml: nombreArchivo,
        estado_ticket: "GE", // generada, aún no enviada
      }, { transaction });

      for (const c of comprobantesData) {
        await ComunicacionBajaDetalle.create({
          baja_id: baja.id,
          comprobante_id: c.id,
          tipo_comprobante_id: c.tipo_comprobante_id,
          serie: c.serie,
          correlativo: c.correlativo,
          motivo_baja: c.motivo_baja,
          estado_previo: c.estado_sunat,
        }, { transaction });
        await Comprobante.update({ estado_sunat: "EN_BAJA" }, { where: { id: c.id }, transaction });
      }
      return { baja, comprobantesData };
    });

    // ── Firma y envío (fuera de la transacción: llamada externa) ──────────
    let ticket;
    try {
      const certPath = process.env.SUNAT_CERT_PATH;
      const certPassword = process.env.SUNAT_CERT_PASSWORD;
      if (!certPath || !certPassword) throw new Error("Certificado digital no configurado");

      const xmlFirmado = xmlSigner.signXml(
        comunicacionBajaBuilder.build({
          emisor,
          comprobantes: comprobantesData,
          fecha_referencia,
          correlativo: baja.correlativo,
          fecha_emision: fechaEmision,
        }),
        certPath,
        certPassword
      );
      storageHelper.saveXml(baja.nombre_xml, xmlFirmado);
      ticket = await sunatClient.sendSummary(Buffer.from(xmlFirmado, "utf8"), baja.nombre_xml, emisor);
    } catch (envioErr) {
      const detalles = await ComunicacionBajaDetalle.findAll({ where: { baja_id: baja.id } });
      await sequelize.transaction(async (transaction) => {
        await revertirComprobantes(detalles, transaction);
        await baja.update({
          estado_ticket: "ER",
          mensaje_sunat: String(envioErr.message).substring(0, 500),
        }, { transaction });
      });
      return res.status(422).json({
        message: "No se pudo enviar la Comunicación de Baja a SUNAT; los comprobantes siguen vigentes",
        error: envioErr.message,
        baja_id: baja.id,
      });
    }

    await baja.update({ ticket, estado_ticket: "PE", fecha_envio: new Date() });

    return res.status(201).json({
      baja_id: baja.id,
      ticket,
      nombre_xml: baja.nombre_xml,
      comprobantes_incluidos: comprobantesData.length,
      message: `Comunicación de Baja enviada. Use GET /comunicacion-baja/${baja.id}/consultar-ticket para confirmar.`,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /comunicacion-baja/:id/consultar-ticket
 * Consulta el resultado de la baja en SUNAT.
 *   - CDR con ResponseCode 0 → comprobantes ANULADO, baja PR (procesada).
 *   - CDR de rechazo         → comprobantes vuelven a su estado previo, baja RR.
 *   - CDR ilegible           → baja ER; NO se asume aceptada (se puede volver a consultar).
 * El CDR (ZIP) se guarda en storage/cdr en todos los casos en que SUNAT lo envía.
 */
const consultarTicketBaja = async (req, res, next) => {
  try {
    const baja = await ComunicacionBaja.findByPk(req.params.id, {
      include: [{ model: Emisor }, { model: ComunicacionBajaDetalle }],
    });

    if (!baja) return res.status(404).json({ message: "Comunicación de Baja no encontrada" });
    if (["PR", "RR"].includes(baja.estado_ticket)) {
      return res.json({
        message: baja.estado_ticket === "PR" ? "Baja ya procesada" : "Baja rechazada por SUNAT",
        estado_ticket: baja.estado_ticket,
        codigo_sunat: baja.codigo_sunat,
        mensaje_sunat: baja.mensaje_sunat,
      });
    }
    if (!baja.ticket) return res.status(409).json({ message: "La baja no tiene ticket (no se envió)", estado_ticket: baja.estado_ticket });

    const status = await sunatClient.getStatus(baja.ticket, baja.Emisor);

    if (status.statusCode === "98") {
      return res.json({ estado_ticket: "PE", message: "SUNAT aún procesando. Reintente pronto." });
    }

    if (!status.content) {
      await baja.update({ estado_ticket: "ER", codigo_sunat: status.statusCode, mensaje_sunat: "SUNAT no devolvió CDR" });
      return res.json({ estado_ticket: "ER", statusCode: status.statusCode, message: "SUNAT no devolvió CDR; vuelva a consultar" });
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
      return res.json({ estado_ticket: "ER", message: "No se pudo leer el CDR; los comprobantes siguen en baja pendiente" });
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
      await baja.update({
        estado_ticket: aceptada ? "PR" : "RR",
        codigo_sunat: cdr.responseCode,
        mensaje_sunat: String(cdr.description + (cdr.notes.length ? " | " + cdr.notes.join(" | ") : "")).substring(0, 500),
      }, { transaction });
    });

    return res.json({
      estado_ticket: aceptada ? "PR" : "RR",
      codigo_sunat: cdr.responseCode,
      mensaje_sunat: cdr.description,
      comprobantes: baja.ComunicacionBajaDetalles.length,
      resultado: aceptada ? "anulados" : "baja rechazada: comprobantes vigentes",
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { crearComunicacionBaja, consultarTicketBaja };
