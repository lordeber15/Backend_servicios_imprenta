"use strict";

const Comprobante = require("../../models/facturacion/comprobante");
const Emisor = require("../../models/facturacion/emisor");
const ComunicacionBaja = require("../../models/facturacion/comunicacionbaja");
const ComunicacionBajaDetalle = require("../../models/facturacion/comunicacionbajadetalle");
require("../../models/facturacion/asociation");

const comunicacionBajaBuilder = require("../../services/sunat/xmlBuilders/comunicacionBajaBuilder");
const xmlSigner = require("../../services/sunat/xmlSigner");
const sunatClient = require("../../services/sunat/sunatClient");
const cdrParser = require("../../services/sunat/cdrParser");
const storageHelper = require("../../services/sunat/storageHelper");

/**
 * POST /comunicacion-baja
 * Body: {
 *   emisor_id: number,
 *   fecha_referencia: "YYYY-MM-DD",   // fecha de los comprobantes a anular
 *   comprobantes: [{ id, motivo_baja }]
 * }
 *
 * Solo para Facturas (01), NC (07) y ND (08) ya ACEPTADAS por SUNAT.
 * Las boletas (03) se anulan a través del Resumen Diario (condicion=3).
 */
const crearComunicacionBaja = async (req, res) => {
  try {
    const { emisor_id, fecha_referencia, comprobantes: compIds } = req.body;

    if (!emisor_id || !fecha_referencia || !compIds || !compIds.length) {
      return res.status(400).json({
        message: "emisor_id, fecha_referencia y comprobantes[] son requeridos",
      });
    }

    const emisor = await Emisor.findByPk(emisor_id);
    if (!emisor) return res.status(404).json({ message: "Emisor no encontrado" });

    // Cargar y validar cada comprobante
    const comprobantesData = [];
    for (const item of compIds) {
      const c = await Comprobante.findByPk(item.id);
      if (!c) {
        return res.status(404).json({ message: `Comprobante id=${item.id} no encontrado` });
      }
      if (c.estado_sunat !== "AC") {
        return res.status(400).json({
          message: `El comprobante ${c.serie}-${c.correlativo} no está en estado ACEPTADO (AC). Estado actual: ${c.estado_sunat}`,
        });
      }
      if (c.tipo_comprobante_id === "03") {
        return res.status(400).json({
          message: `Las boletas (03) no se anulan por Comunicación de Baja. Use Resumen Diario con condición=3.`,
        });
      }
      comprobantesData.push({
        ...c.dataValues,
        motivo_baja: item.motivo_baja || "Anulación por error en emisión",
      });
    }

    // Correlativo del RA del día
    const raCount = await ComunicacionBaja.count({ where: { emisor_id, fecha_emision: new Date().toISOString().split("T")[0] } });
    const correlativo = raCount + 1;
    const fechaStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const nombreArchivo = `${emisor.ruc}-RA-${fechaStr}-${correlativo}`;

    // Construir y firmar XML
    const xmlSinFirmar = comunicacionBajaBuilder.build({
      emisor,
      comprobantes: comprobantesData,
      fecha_referencia,
      correlativo,
    });

    const certPath = process.env.SUNAT_CERT_PATH;
    const certPassword = process.env.SUNAT_CERT_PASSWORD;

    if (!certPath || !certPassword) {
      return res.status(500).json({ message: "Certificado digital no configurado" });
    }

    const xmlFirmado = xmlSigner.signXml(xmlSinFirmar, certPath, certPassword);
    storageHelper.saveXml(nombreArchivo, xmlFirmado);

    // Enviar a SUNAT (asíncrono)
    const xmlBuffer = Buffer.from(xmlFirmado, "utf8");
    let ticket;
    try {
      ticket = await sunatClient.sendSummary(xmlBuffer, nombreArchivo, emisor);
    } catch (soapErr) {
      return res.status(422).json({
        message: "Error al enviar Comunicación de Baja a SUNAT",
        error: soapErr.message,
      });
    }

    // Registrar la baja en BD
    const baja = await ComunicacionBaja.create({
      emisor_id,
      correlativo,
      fecha_emision: new Date().toISOString().split("T")[0],
      fecha_referencia,
      nombre_xml: nombreArchivo,
      ticket,
      estado_ticket: "PE",
      fecha_envio: new Date(),
    });

    for (const c of comprobantesData) {
      await ComunicacionBajaDetalle.create({
        baja_id: baja.id,
        comprobante_id: c.id,
        tipo_comprobante_id: c.tipo_comprobante_id,
        serie: c.serie,
        correlativo: c.correlativo,
        motivo_baja: c.motivo_baja,
      });
      // Marcar como anulación en proceso
      await Comprobante.update({ estado_sunat: "EN" }, { where: { id: c.id } });
    }

    return res.status(201).json({
      baja_id: baja.id,
      ticket,
      nombre_xml: nombreArchivo,
      comprobantes_incluidos: comprobantesData.length,
      message: `Comunicación de Baja enviada. Use GET /comunicacion-baja/${baja.id}/consultar-ticket para confirmar.`,
    });
  } catch (err) {
    console.error("crearComunicacionBaja error:", err);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * GET /comunicacion-baja/:id/consultar-ticket
 * Consulta el resultado del ticket de la Comunicación de Baja.
 */
const consultarTicketBaja = async (req, res) => {
  try {
    const baja = await ComunicacionBaja.findByPk(req.params.id, {
      include: [{ model: Emisor }, { model: ComunicacionBajaDetalle }],
    });

    if (!baja) return res.status(404).json({ message: "Comunicación de Baja no encontrada" });

    if (baja.estado_ticket === "PR") {
      return res.json({
        message: "Baja ya fue procesada",
        estado_ticket: "PR",
        codigo_sunat: baja.codigo_sunat,
      });
    }

    const status = await sunatClient.getStatus(baja.ticket, baja.Emisor);

    if (status.statusCode === "98") {
      return res.json({ estado_ticket: "PE", message: "SUNAT aún procesando. Reintente pronto." });
    }

    if (status.statusCode === "0") {
      let cdr = { responseCode: "0", accepted: true, description: "Aceptado", digestValue: "" };
      if (status.content) {
        try { cdr = cdrParser.parseCdr(status.content); } catch (_) {}
      }

      // Marcar comprobantes como anulados
      for (const det of baja.ComunicacionBajaDetalles) {
        await Comprobante.update({ estado_sunat: "AN" }, { where: { id: det.comprobante_id } });
      }

      await baja.update({
        estado_ticket: "PR",
        codigo_sunat: cdr.responseCode,
        mensaje_sunat: cdr.description,
      });

      return res.json({
        estado_ticket: "PR",
        codigo_sunat: cdr.responseCode,
        comprobantes_anulados: baja.ComunicacionBajaDetalles.length,
      });
    }

    await baja.update({ estado_ticket: "ER", codigo_sunat: status.statusCode });
    return res.json({ estado_ticket: "ER", statusCode: status.statusCode });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { crearComunicacionBaja, consultarTicketBaja };
