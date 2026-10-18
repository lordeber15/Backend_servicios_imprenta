"use strict";

const { Op } = require("sequelize");
const { registrar } = require("../../../../application/services/auditoria.service");
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
const { consultarBaja, revertirComprobantes } = require("../../../../application/services/ticketsSunat.service");

// Solo se da de baja lo que SUNAT tiene registrado.
const ESTADOS_ANULABLES = ["ACEPTADO", "OBSERVADO"];

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
    registrar(req, "baja_enviada", {
      entidad: "ComunicacionBaja",
      entidad_id: baja.id,
      despues: { ticket, comprobantes: comprobantesData.map((c) => ({ id: c.id, numero: `${c.serie}-${c.correlativo}`, motivo: c.motivo_baja })) },
    });

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
 * Consulta el resultado de la baja en SUNAT (ver ticketsSunat.service).
 * El vigilante del worker también la consulta solo cada 15 min.
 */
const consultarTicketBaja = async (req, res, next) => {
  try {
    const r = await consultarBaja(req.params.id, req);
    return res.status(r.httpStatus).json(r.body);
  } catch (err) {
    return next(err);
  }
};

module.exports = { crearComunicacionBaja, consultarTicketBaja };
