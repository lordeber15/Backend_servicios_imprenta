/**
 * CONTROLADOR DE INTEGRACIÓN SUNAT (EMISIÓN ELECTRÓNICA)
 * 
 * Este controlador es el corazón del sistema de facturación. Orquesta el proceso completo:
 * 1. Recupera la información del comprobante y sus relaciones desde la base de datos.
 * 2. Valida el estado actual y el tipo de comprobante.
 * 3. Genera el XML UBL 2.1 correspondiente mediante builders.
 * 4. Firma digitalmente el XML con el certificado (.p12).
 * 5. Envía el paquete (ZIP) a los Web Services de SUNAT (SOAP).
 * 6. Procesa la respuesta de SUNAT (CDR), actualiza el estado y genera recursos (QR, PDF).
 * 
 * @module controllers/facturacion/sunat.controller
 */

/**
 * Orquesta la emisión de un comprobante individual (Factura, Boleta, Notas).
 * 
 * @route POST /api/comprobante/emitir
 * @param {Object} req.body.comprobante_id - ID del comprobante a emitir.
 */
const emitirComprobante = async (req, res) => {
  try {
    const { comprobante_id } = req.body;
    if (!comprobante_id) {
      return res.status(400).json({ message: "comprobante_id es requerido" });
    }

    // 1. Cargar comprobante con todas las relaciones necesarias
    const comprobante = await Comprobante.findByPk(comprobante_id, {
      include: [
        { model: Emisor },
        {
          model: Cliente,
          include: [{ model: TipoDocumento }],
        },
        {
          model: Detalle,
          include: [
            {
              model: Producto,
              include: [TipoAfectacion, Unidad],
            },
          ],
        },
        { model: TipoComprobante },
        { model: Moneda },
        { model: Serie },
        { model: Cuota },
        { model: Comprobante, as: "comprobanteRef" },
      ],
    });

    if (!comprobante) {
      return res.status(404).json({ message: "Comprobante no encontrado" });
    }

    // 2. Validaciones previas
    if (comprobante.estado_sunat === "AC") {
      return res.status(400).json({
        message: "El comprobante ya fue aceptado por SUNAT",
        estado_sunat: "AC",
      });
    }

    const tiposPermitidos = ["01", "03", "07", "08"];
    if (!tiposPermitidos.includes(comprobante.tipo_comprobante_id)) {
      return res.status(400).json({
        message: `Tipo de comprobante ${comprobante.tipo_comprobante_id} no soportado por este endpoint. Use /guia/emitir para guías.`,
      });
    }

    if (!comprobante.Emisor) {
      return res.status(400).json({ message: "El comprobante no tiene emisor asignado" });
    }

    // 3. Construir nombre del archivo SUNAT
    const correlativoStr = String(comprobante.correlativo).padStart(8, "0");
    const nombreArchivo = `${comprobante.Emisor.ruc}-${comprobante.tipo_comprobante_id}-${comprobante.serie}-${correlativoStr}`;

    // 4. Seleccionar builder según tipo de comprobante
    let xmlSinFirmar;
    if (comprobante.tipo_comprobante_id === "01") {
      xmlSinFirmar = facturaBuilder.build(comprobante);
    } else if (comprobante.tipo_comprobante_id === "03") {
      xmlSinFirmar = boletaBuilder.build(comprobante);
    } else if (["07", "08"].includes(comprobante.tipo_comprobante_id)) {
      xmlSinFirmar = facturaBuilder.buildNota(comprobante);
    }

    // 5. Firmar el XML con el certificado digital
    const certPath = process.env.SUNAT_CERT_PATH;
    const certPassword = process.env.SUNAT_CERT_PASSWORD;

    if (!certPath || !certPassword) {
      return res.status(500).json({
        message: "Certificado digital no configurado. Revisar SUNAT_CERT_PATH y SUNAT_CERT_PASSWORD en .env",
      });
    }

    let xmlFirmado;
    try {
      xmlFirmado = xmlSigner.signXml(xmlSinFirmar, certPath, certPassword);
    } catch (signErr) {
      return res.status(500).json({
        message: "Error al firmar el XML: " + signErr.message,
      });
    }

    // 6. Guardar XML firmado en disco
    storageHelper.saveXml(nombreArchivo, xmlFirmado);

    // 7. Enviar a SUNAT
    let cdrBase64;
    try {
      const xmlBuffer = Buffer.from(xmlFirmado, "utf8");
      cdrBase64 = await sunatClient.sendBill(xmlBuffer, nombreArchivo, comprobante.Emisor);
    } catch (soapErr) {
      // SUNAT rechazó directamente con SOAP fault
      const codigoErr = soapErr.root?.Envelope?.Body?.Fault?.detail?.fault?.faultCode || "SOAP_ERR";
      const mensajeErr = soapErr.message || "Error en comunicación con SUNAT";

      await comprobante.update({
        estado_sunat: "RR",
        codigo_sunat: String(codigoErr),
        mensaje_sunat: mensajeErr,
        nombre_xml: nombreArchivo,
        fecha_envio_sunat: new Date(),
        intentos_envio: (comprobante.intentos_envio || 0) + 1,
      });

      return res.status(422).json({
        message: "SUNAT rechazó el comprobante",
        codigo_sunat: String(codigoErr),
        mensaje_sunat: mensajeErr,
      });
    }

    // 8. Guardar CDR en disco
    if (cdrBase64) {
      storageHelper.saveCdr(nombreArchivo, cdrBase64);
    }

    // 9. Parsear CDR
    let cdr = { responseCode: "0", description: "Aceptado", notes: [], digestValue: "", accepted: true };
    if (cdrBase64) {
      try {
        cdr = cdrParser.parseCdr(cdrBase64);
      } catch (parseErr) {
        console.error("Error al parsear CDR:", parseErr.message);
      }
    }

    // 10. Generar QR
    let qrBase64 = "";
    try {
      qrBase64 = await qrGenerator.generarQr(comprobante, cdr.digestValue);
    } catch (qrErr) {
      console.error("Error al generar QR:", qrErr.message);
    }

    // 11. Actualizar estado en BD
    const estadoSunat = cdr.accepted ? "AC" : "RR";
    await comprobante.update({
      estado_sunat: estadoSunat,
      codigo_sunat: cdr.responseCode,
      mensaje_sunat:
        cdr.description + (cdr.notes.length ? " | " + cdr.notes.join(" | ") : ""),
      hash_cpe: cdr.digestValue,
      nombre_xml: nombreArchivo,
      fecha_envio_sunat: new Date(),
      intentos_envio: (comprobante.intentos_envio || 0) + 1,
    });

    // 12. Incrementar correlativo en la Serie (solo si fue aceptado)
    if (cdr.accepted && comprobante.Serie) {
      await Serie.update(
        { correlativo: comprobante.correlativo + 1 },
        { where: { id: comprobante.serie_id } }
      );
    }

    // 13. Guardar QR en el comprobante para el PDF (recargar objeto)
    comprobante.qr_data = qrBase64;
    comprobante.nombre_xml = nombreArchivo;
    comprobante.hash_cpe = cdr.digestValue;

    return res.status(200).json({
      success: cdr.accepted,
      comprobante_id: comprobante.id,
      nombre_xml: nombreArchivo,
      codigo_sunat: cdr.responseCode,
      mensaje_sunat: cdr.description,
      observaciones: cdr.notes,
      hash_cpe: cdr.digestValue,
      estado_sunat: estadoSunat,
      pdf_url: `/comprobante/${comprobante.id}/pdf`,
      xml_url: `/comprobante/${comprobante.id}/xml`,
    });
  } catch (err) {
    console.error("emitirComprobante error:", err);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * POST /comprobante/:id/reenviar
 * Reintenta enviar un comprobante en estado RR (rechazado).
 */
const reenviarComprobante = async (req, res) => {
  try {
    const comprobante = await Comprobante.findByPk(req.params.id, {
      include: [Emisor],
    });

    if (!comprobante) {
      return res.status(404).json({ message: "Comprobante no encontrado" });
    }

    if (comprobante.estado_sunat === "AC") {
      return res.status(400).json({ message: "El comprobante ya fue aceptado" });
    }

    if (!comprobante.nombre_xml || !storageHelper.existsXml(comprobante.nombre_xml)) {
      return res.status(400).json({
        message: "No se encontró el XML firmado. Use /comprobante/emitir para generar uno nuevo.",
      });
    }

    const xmlFirmado = storageHelper.readXml(comprobante.nombre_xml);
    const xmlBuffer = Buffer.from(xmlFirmado, "utf8");

    let cdrBase64;
    try {
      cdrBase64 = await sunatClient.sendBill(xmlBuffer, comprobante.nombre_xml, comprobante.Emisor);
    } catch (soapErr) {
      await comprobante.update({
        estado_sunat: "RR",
        codigo_sunat: "SOAP_ERR",
        mensaje_sunat: soapErr.message,
        intentos_envio: (comprobante.intentos_envio || 0) + 1,
      });
      return res.status(422).json({ message: "SUNAT rechazó el comprobante", error: soapErr.message });
    }

    if (cdrBase64) storageHelper.saveCdr(comprobante.nombre_xml, cdrBase64);

    const cdr = cdrBase64 ? cdrParser.parseCdr(cdrBase64) : { responseCode: "0", description: "OK", notes: [], digestValue: "", accepted: true };

    await comprobante.update({
      estado_sunat: cdr.accepted ? "AC" : "RR",
      codigo_sunat: cdr.responseCode,
      mensaje_sunat: cdr.description + (cdr.notes.length ? " | " + cdr.notes.join(" | ") : ""),
      hash_cpe: cdr.digestValue,
      fecha_envio_sunat: new Date(),
      intentos_envio: (comprobante.intentos_envio || 0) + 1,
    });

    return res.json({ success: cdr.accepted, codigo_sunat: cdr.responseCode, mensaje_sunat: cdr.description });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * GET /comprobante/:id/estado
 * Retorna el estado SUNAT del comprobante desde la BD.
 */
const consultarEstado = async (req, res) => {
  try {
    const comprobante = await Comprobante.findByPk(req.params.id, {
      attributes: ["id", "serie", "correlativo", "tipo_comprobante_id", "estado_sunat", "codigo_sunat", "mensaje_sunat", "hash_cpe", "nombre_xml", "fecha_envio_sunat"],
    });

    if (!comprobante) return res.status(404).json({ message: "Comprobante no encontrado" });

    return res.json(comprobante);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * GET /comprobante/:id/pdf
 * Genera (o retorna desde caché) el PDF de la representación impresa.
 */
const descargarPdf = async (req, res) => {
  try {
    const comprobante = await Comprobante.findByPk(req.params.id, {
      include: [
        Emisor,
        { model: Cliente, include: [TipoDocumento] },
        { model: Detalle, include: [{ model: Producto, include: [Unidad] }] },
        TipoComprobante,
        Moneda,
      ],
    });
    require("../../models/facturacion/asociation");

    if (!comprobante) return res.status(404).json({ message: "Comprobante no encontrado" });
    if (!comprobante.nombre_xml) {
      return res.status(400).json({ message: "El comprobante no tiene un XML generado aún. Emitirlo primero." });
    }

    const pdfPath = storageHelper.getPdfPath(comprobante.nombre_xml);

    // Generar QR si hay hash
    let qrBase64 = "";
    try {
      qrBase64 = await qrGenerator.generarQr(comprobante, comprobante.hash_cpe);
    } catch (_) { /* continúa sin QR */ }

    // Generar PDF si no existe o forzar regeneración
    if (!storageHelper.existsPdf(comprobante.nombre_xml)) {
      await pdfGenerator.generarPdf(comprobante, qrBase64);
    }

    return res.download(pdfPath, `${comprobante.nombre_xml}.pdf`);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * GET /comprobante/:id/xml
 * Descarga el XML firmado del comprobante.
 */
const descargarXml = async (req, res) => {
  try {
    const comprobante = await Comprobante.findByPk(req.params.id, {
      attributes: ["id", "nombre_xml"],
    });

    if (!comprobante) return res.status(404).json({ message: "Comprobante no encontrado" });
    if (!comprobante.nombre_xml || !storageHelper.existsXml(comprobante.nombre_xml)) {
      return res.status(404).json({ message: "XML no disponible. El comprobante aún no fue emitido." });
    }

    const xmlPath = storageHelper.getXmlPath(comprobante.nombre_xml);
    return res.download(xmlPath, `${comprobante.nombre_xml}.xml`);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  emitirComprobante,
  reenviarComprobante,
  consultarEstado,
  descargarPdf,
  descargarXml,
};
