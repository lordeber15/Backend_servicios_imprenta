"use strict";
const { Op } = require("sequelize");

const Comprobante = require("../../../database/models/facturacion/comprobante");
const Emisor = require("../../../database/models/facturacion/emisor");
const Cliente = require("../../../database/models/facturacion/cliente");
const EnvioResumen = require("../../../database/models/facturacion/envioresumen");
const EnvioResumenDetalle = require("../../../database/models/facturacion/envioresumendetalle");
require("../../../database/models/facturacion/asociation");

const resumenDiarioBuilder = require("../../../external_services/sunat/xmlBuilders/resumenDiarioBuilder");
const xmlSigner = require("../../../external_services/sunat/xmlSigner");
const sunatClient = require("../../../external_services/sunat/sunatClient");
const cdrParser = require("../../../external_services/sunat/cdrParser");
const storageHelper = require("../../../external_services/sunat/storageHelper");
const sequelize = require("../../../database/database");
const { hoyLocal } = require("../../../utils/fecha");
const { consultarResumen } = require("../../../../application/services/ticketsSunat.service");

// NOTA: en este sistema las boletas se envían individualmente (sendBill vía la
// cola sunat-envio), así que no quedan boletas "pendientes de resumen": la
// selección de abajo hoy no encuentra registros. Se mantiene el endpoint con
// numeración, CDR y estados corregidos para cuando se use (p. ej. anulación de
// boletas con condición 3).

/**
 * POST /resumen-diario
 * Body: { emisor_id, fecha_referencia: "YYYY-MM-DD" }
 *
 * Agrupa todas las boletas (tipo 03) pendientes de la fecha indicada
 * y las envía a SUNAT como Resumen Diario (RC).
 * Retorna el ticket para consultar el resultado (async).
 */
const generarResumenDiario = async (req, res, next) => {
  try {
    const { emisor_id, fecha_referencia } = req.body;

    if (!emisor_id || !fecha_referencia) {
      return res.status(400).json({ message: "emisor_id y fecha_referencia son requeridos" });
    }

    const emisor = await Emisor.findByPk(emisor_id);
    if (!emisor) return res.status(404).json({ message: "Emisor no encontrado" });

    // Rango de fecha: todo el día indicado
    const fechaInicio = new Date(fecha_referencia + "T00:00:00");
    const fechaFin = new Date(fecha_referencia + "T23:59:59");

    // Obtener boletas pendientes (PE) o rechazadas (RR) de la fecha
    const boletas = await Comprobante.findAll({
      where: {
        emisor_id,
        tipo_comprobante_id: "03",
        fecha_emision: { [Op.between]: [fechaInicio, fechaFin] },
        estado_sunat: { [Op.in]: ["PE", "RR"] },
      },
      include: [{ model: Cliente }, { model: EnvioResumenDetalle, required: false }],
    });

    if (!boletas.length) {
      return res.status(400).json({
        message: `No hay boletas pendientes para la fecha ${fecha_referencia}`,
      });
    }

    // Correlativo del RC: bloqueo consultivo por emisor+fecha para que dos
    // envíos simultáneos no tomen el mismo número (índice único de respaldo).
    const correlativo = await sequelize.transaction(async (transaction) => {
      await sequelize.query("SELECT pg_advisory_xact_lock(hashtext(:clave))", {
        replacements: { clave: `RC:${emisor_id}:${fecha_referencia}` },
        transaction,
      });
      const max = await EnvioResumen.max("correlativo", {
        where: { emisor_id, tipo: "RC", fecha_referencia },
        transaction,
      });
      const siguiente = (max || 0) + 1;
      // Se reserva el número creando el registro antes de firmar/enviar.
      await EnvioResumen.create({
        emisor_id, fecha_referencia, correlativo: siguiente, tipo: "RC", estado_ticket: "GE", resumen: 1,
      }, { transaction });
      return siguiente;
    });

    // Construir y firmar XML del Resumen Diario
    const xmlSinFirmar = resumenDiarioBuilder.build({
      emisor,
      boletas,
      fecha_referencia,
      correlativo,
      fecha_emision: hoyLocal(),
    });

    const certPath = process.env.SUNAT_CERT_PATH;
    const certPassword = process.env.SUNAT_CERT_PASSWORD;

    if (!certPath || !certPassword) {
      return res.status(500).json({ message: "Certificado digital no configurado" });
    }

    const xmlFirmado = xmlSigner.signXml(xmlSinFirmar, certPath, certPassword);
    const fechaStr = fecha_referencia.replace(/-/g, "");
    const nombreArchivo = `${emisor.ruc}-RC-${fechaStr}-${correlativo}`;

    storageHelper.saveXml(nombreArchivo, xmlFirmado);

    // Enviar a SUNAT (asíncrono → retorna ticket)
    const xmlBuffer = Buffer.from(xmlFirmado, "utf8");
    let ticket;
    try {
      ticket = await sunatClient.sendSummary(xmlBuffer, nombreArchivo, emisor);
    } catch (soapErr) {
      return res.status(422).json({
        message: "Error al enviar Resumen Diario a SUNAT",
        error: soapErr.message,
      });
    }

    // Completar el registro reservado con el resultado del envío
    const envio = await EnvioResumen.findOne({ where: { emisor_id, tipo: "RC", fecha_referencia, correlativo } });
    await envio.update({
      fecha_envio: new Date(),
      nombrexml: nombreArchivo,
      ticket,
      estado_ticket: "PE",
      xml_firmado: xmlFirmado,
    });

    // Registrar cada boleta en EnvioResumenDetalle y marcarlas como "EN" (en proceso)
    for (const boleta of boletas) {
      await EnvioResumenDetalle.create({
        envio_id: envio.id,
        comprobante_id: boleta.id,
        condicion: 1, // 1=adición
      });
      await boleta.update({ estado_sunat: "ENVIANDO" });
    }

    return res.status(201).json({
      envio_id: envio.id,
      ticket,
      nombre_xml: nombreArchivo,
      boletas_incluidas: boletas.length,
      message: `Resumen Diario enviado. Use GET /resumen-diario/${envio.id}/consultar-ticket para obtener el resultado.`,
    });
  } catch (err) {
    console.error("generarResumenDiario error:", err);
    return next(err);
  }
};

/**
 * GET /resumen-diario/:id/consultar-ticket
 * Consulta el estado del Resumen Diario en SUNAT (ver ticketsSunat.service).
 */
const consultarTicketResumen = async (req, res, next) => {
  try {
    const r = await consultarResumen(req.params.id, req);
    return res.status(r.httpStatus).json(r.body);
  } catch (err) {
    console.error("consultarTicketResumen error:", err.message);
    return next(err);
  }
};

module.exports = { generarResumenDiario, consultarTicketResumen };
