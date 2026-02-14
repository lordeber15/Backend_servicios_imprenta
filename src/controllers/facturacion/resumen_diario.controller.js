"use strict";
const { Op } = require("sequelize");

const Comprobante = require("../../models/facturacion/comprobante");
const Emisor = require("../../models/facturacion/emisor");
const Cliente = require("../../models/facturacion/cliente");
const EnvioResumen = require("../../models/facturacion/envioresumen");
const EnvioResumenDetalle = require("../../models/facturacion/envioresumendetalle");
require("../../models/facturacion/asociation");

const resumenDiarioBuilder = require("../../services/sunat/xmlBuilders/resumenDiarioBuilder");
const xmlSigner = require("../../services/sunat/xmlSigner");
const sunatClient = require("../../services/sunat/sunatClient");
const cdrParser = require("../../services/sunat/cdrParser");
const storageHelper = require("../../services/sunat/storageHelper");

/**
 * POST /resumen-diario
 * Body: { emisor_id, fecha_referencia: "YYYY-MM-DD" }
 *
 * Agrupa todas las boletas (tipo 03) pendientes de la fecha indicada
 * y las envía a SUNAT como Resumen Diario (RC).
 * Retorna el ticket para consultar el resultado (async).
 */
const generarResumenDiario = async (req, res) => {
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

    // Calcular correlativo del RC del día (puede haber múltiples por día)
    const rcCount = await EnvioResumen.count({
      where: { emisor_id, tipo: "RC", fecha_referencia },
    });
    const correlativo = rcCount + 1;

    // Construir y firmar XML del Resumen Diario
    const xmlSinFirmar = resumenDiarioBuilder.build({
      emisor,
      boletas,
      fecha_referencia,
      correlativo,
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

    // Registrar el envío en EnvioResumen
    const envio = await EnvioResumen.create({
      emisor_id,
      fecha_envio: new Date(),
      fecha_referencia,
      correlativo,
      nombrexml: nombreArchivo,
      ticket,
      tipo: "RC",
      estado_ticket: "PE",
      resumen: 1,
      xml_firmado: xmlFirmado,
    });

    // Registrar cada boleta en EnvioResumenDetalle y marcarlas como "EN" (en proceso)
    for (const boleta of boletas) {
      await EnvioResumenDetalle.create({
        envio_id: envio.id,
        comprobante_id: boleta.id,
        condicion: 1, // 1=adición
      });
      await boleta.update({ estado_sunat: "EN" });
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
    return res.status(500).json({ message: err.message });
  }
};

/**
 * GET /resumen-diario/:id/consultar-ticket
 * Consulta el estado del Resumen Diario en SUNAT usando el ticket almacenado.
 */
const consultarTicketResumen = async (req, res) => {
  try {
    const envio = await EnvioResumen.findByPk(req.params.id, {
      include: [
        { model: Emisor },
        { model: EnvioResumenDetalle },
      ],
    });

    if (!envio) return res.status(404).json({ message: "Resumen no encontrado" });
    if (!envio.ticket) return res.status(400).json({ message: "No hay ticket para consultar" });

    if (envio.estado_ticket === "PR") {
      return res.json({
        message: "Resumen Diario ya fue procesado",
        estado_ticket: "PR",
        codigo_sunat: envio.codigo_sunat,
        mensaje_sunat: envio.mensaje_sunat,
      });
    }

    const status = await sunatClient.getStatus(envio.ticket, envio.Emisor);

    if (status.statusCode === "98") {
      // Aún en proceso, reintentar más tarde
      return res.json({
        estado_ticket: "PE",
        message: "SUNAT aún está procesando el Resumen Diario. Reintente en unos segundos.",
        statusCode: status.statusCode,
      });
    }

    if (status.statusCode === "0" && status.content) {
      // Procesado correctamente
      let cdr;
      try {
        cdr = cdrParser.parseCdr(status.content);
      } catch (_) {
        cdr = { responseCode: "0", description: "Aceptado", digestValue: "", accepted: true, notes: [] };
      }

      // Actualizar todas las boletas incluidas
      for (const det of envio.EnvioResumenDetalles) {
        await Comprobante.update(
          {
            estado_sunat: cdr.accepted ? "AC" : "RR",
            codigo_sunat: cdr.responseCode,
            mensaje_sunat: cdr.description,
            hash_cpe: cdr.digestValue,
          },
          { where: { id: det.comprobante_id } }
        );
      }

      await envio.update({
        estado_ticket: "PR",
        codigo_sunat: cdr.responseCode,
        mensaje_sunat: cdr.description,
      });

      return res.json({
        estado_ticket: "PR",
        codigo_sunat: cdr.responseCode,
        mensaje_sunat: cdr.description,
        boletas_actualizadas: envio.EnvioResumenDetalles.length,
      });
    }

    // Error en SUNAT
    await envio.update({ estado_ticket: "ER", codigo_sunat: status.statusCode });

    return res.json({
      estado_ticket: "ER",
      statusCode: status.statusCode,
      message: "SUNAT retornó error al procesar el Resumen Diario",
    });
  } catch (err) {
    console.error("consultarTicketResumen error:", err);
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { generarResumenDiario, consultarTicketResumen };
