"use strict";

const GuiaRemision = require("../../../database/models/facturacion/guiaremision");
const DetalleGuia = require("../../../database/models/facturacion/detalleguia");
const Emisor = require("../../../database/models/facturacion/emisor");
const Cliente = require("../../../database/models/facturacion/cliente");
const Unidad = require("../../../database/models/facturacion/unidad");
const Comprobante = require("../../../database/models/facturacion/comprobante");
const Serie = require("../../../database/models/facturacion/serie");
require("../../../database/models/facturacion/asociation");

const guiaRemisionBuilder = require("../../../external_services/sunat/xmlBuilders/guiaRemisionBuilder");
const xmlSigner = require("../../../external_services/sunat/xmlSigner");
const sunatClient = require("../../../external_services/sunat/sunatClient");
const cdrParser = require("../../../external_services/sunat/cdrParser");
const pdfGenerator = require("../../../external_services/sunat/pdfGenerator");
const storageHelper = require("../../../external_services/sunat/storageHelper");

const createGuia = async (req, res) => {
  try {
    const guia = await GuiaRemision.create(req.body);
    return res.status(201).json(guia);
  } catch (err) {
    console.error("Error creating guia:", err);
    return res.status(500).json({ message: err.message });
  }
};

const createDetalleGuia = async (req, res) => {
  try {
    const detalle = await DetalleGuia.create(req.body);
    return res.status(201).json(detalle);
  } catch (err) {
    console.error("Error creating detalle guia:", err);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * POST /guia/emitir
 * Body: { guia_id }
 *
 * Emite una Guía de Remisión Remitente (09) o Transportista (31) a SUNAT.
 */
const emitirGuia = async (req, res) => {
  try {
    const { guia_id } = req.body;
    if (!guia_id) return res.status(400).json({ message: "guia_id es requerido" });

    const guia = await GuiaRemision.findByPk(guia_id, {
      include: [
        { model: Emisor },
        { model: Cliente, as: "Destinatario" },
        {
          model: DetalleGuia,
          include: [{ model: Unidad }],
        },
        { model: Comprobante, as: "ComprobanteRelacionado" },
      ],
    });

    if (!guia) return res.status(404).json({ message: "Guía no encontrada" });
    if (guia.estado_sunat === "AC") {
      return res.status(400).json({ message: "La guía ya fue aceptada por SUNAT" });
    }

    const emisor = guia.Emisor;
    const correlativoStr = String(guia.correlativo).padStart(8, "0");
    const nombreArchivo = `${emisor.ruc}-${guia.tipo_guia}-${guia.serie}-${correlativoStr}`;

    // Generar XML sin firmar
    const xmlSinFirmar = guiaRemisionBuilder.build(guia);

    const certPath = process.env.SUNAT_CERT_PATH;
    const certPassword = process.env.SUNAT_CERT_PASSWORD;

    if (!certPath || !certPassword) {
      return res.status(500).json({ message: "Certificado digital no configurado" });
    }

    let xmlFirmado;
    try {
      xmlFirmado = xmlSigner.signXml(xmlSinFirmar, certPath, certPassword);
    } catch (signErr) {
      return res.status(500).json({ message: "Error al firmar XML: " + signErr.message });
    }

    storageHelper.saveXml(nombreArchivo, xmlFirmado);

    // Enviar a SUNAT (WS de guías, síncrono)
    let cdrBase64;
    try {
      const xmlBuffer = Buffer.from(xmlFirmado, "utf8");
      cdrBase64 = await sunatClient.sendBillGuia(xmlBuffer, nombreArchivo, emisor);
    } catch (soapErr) {
      await guia.update({
        estado_sunat: "RR",
        codigo_sunat: "SOAP_ERR",
        mensaje_sunat: soapErr.message,
        nombre_xml: nombreArchivo,
        fecha_envio_sunat: new Date(),
        intentos_envio: (guia.intentos_envio || 0) + 1,
      });
      return res.status(422).json({ message: "SUNAT rechazó la guía", error: soapErr.message });
    }

    if (cdrBase64) storageHelper.saveCdr(nombreArchivo, cdrBase64);

    let cdr = { responseCode: "0", description: "Aceptado", digestValue: "", notes: [], accepted: true };
    if (cdrBase64) {
      try { cdr = cdrParser.parseCdr(cdrBase64); } catch (_) {}
    }

    await guia.update({
      estado_sunat: cdr.accepted ? "AC" : "RR",
      codigo_sunat: cdr.responseCode,
      mensaje_sunat: cdr.description + (cdr.notes.length ? " | " + cdr.notes.join(" | ") : ""),
      hash_cpe: cdr.digestValue,
      nombre_xml: nombreArchivo,
      fecha_envio_sunat: new Date(),
      intentos_envio: (guia.intentos_envio || 0) + 1,
    });

    if (cdr.accepted) {
      const serieRec = await Serie.findOne({ where: { serie: guia.serie } });
      if (serieRec) {
        await serieRec.update({ correlativo: guia.correlativo + 1 });
      }
    }

    return res.json({
      success: cdr.accepted,
      guia_id: guia.id,
      nombre_xml: nombreArchivo,
      codigo_sunat: cdr.responseCode,
      mensaje_sunat: cdr.description,
      estado_sunat: cdr.accepted ? "AC" : "RR",
      pdf_url: `/guia/${guia.id}/pdf`,
      xml_url: `/guia/${guia.id}/xml`,
    });
  } catch (err) {
    console.error("emitirGuia error:", err);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * GET /guia/:id/estado
 */
const consultarEstadoGuia = async (req, res) => {
  try {
    const guia = await GuiaRemision.findByPk(req.params.id, {
      attributes: ["id", "serie", "correlativo", "tipo_guia", "estado_sunat", "codigo_sunat", "mensaje_sunat", "hash_cpe", "nombre_xml", "fecha_envio_sunat"],
    });
    if (!guia) return res.status(404).json({ message: "Guía no encontrada" });
    return res.json(guia);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * GET /guia/:id/pdf
 * Genera y descarga el PDF de la guía de remisión.
 */
const descargarPdfGuia = async (req, res) => {
  try {
    const guia = await GuiaRemision.findByPk(req.params.id, {
      include: [Emisor, { model: Cliente, as: "Destinatario" }],
    });
    if (!guia) return res.status(404).json({ message: "Guía no encontrada" });
    if (!guia.nombre_xml) return res.status(400).json({ message: "La guía no tiene XML generado aún" });

    const pdfPath = storageHelper.getPdfPath(guia.nombre_xml);

    if (!storageHelper.existsPdf(guia.nombre_xml)) {
      // Para guías el PDF se genera con una versión simplificada (sin importes)
      await pdfGenerator.generarPdf(
        {
          ...guia.dataValues,
          Emisor: guia.Emisor,
          Cliente: guia.Destinatario,
          Detalles: [],
          TipoComprobante: { descripcion: guia.tipo_guia === "09" ? "GUÍA DE REMISIÓN REMITENTE" : "GUÍA DE REMISIÓN TRANSPORTISTA" },
          op_gravadas: 0, op_exoneradas: 0, op_inafectas: 0, igv: 0, total: 0,
        },
        ""
      );
    }

    return res.download(pdfPath, `${guia.nombre_xml}.pdf`);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * GET /guia/:id/xml
 */
const descargarXmlGuia = async (req, res) => {
  try {
    const guia = await GuiaRemision.findByPk(req.params.id, { attributes: ["id", "nombre_xml"] });
    if (!guia) return res.status(404).json({ message: "Guía no encontrada" });
    if (!guia.nombre_xml || !storageHelper.existsXml(guia.nombre_xml)) {
      return res.status(404).json({ message: "XML no disponible" });
    }
    return res.download(storageHelper.getXmlPath(guia.nombre_xml), `${guia.nombre_xml}.xml`);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { createGuia, createDetalleGuia, emitirGuia, consultarEstadoGuia, descargarPdfGuia, descargarXmlGuia };
