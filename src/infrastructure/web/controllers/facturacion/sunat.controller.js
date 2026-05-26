"use strict";

const Comprobante    = require("../../../database/models/facturacion/comprobante");
const Emisor         = require("../../../database/models/facturacion/emisor");
const Cliente        = require("../../../database/models/facturacion/cliente");
const TipoDocumento  = require("../../../database/models/facturacion/tipodocumento");
const Detalle        = require("../../../database/models/facturacion/detalles");
const Producto       = require("../../../database/models/facturacion/producto");
const TipoAfectacion = require("../../../database/models/facturacion/tipoafectacion");
const Unidad         = require("../../../database/models/facturacion/unidad");
const TipoComprobante = require("../../../database/models/facturacion/tipocomprobante");
const Moneda         = require("../../../database/models/facturacion/moneda");
const Serie          = require("../../../database/models/facturacion/serie");
const Cuota          = require("../../../database/models/facturacion/cuota");

require("../../../database/models/facturacion/asociation");

const facturaBuilder = require("../../../external_services/sunat/xmlBuilders/facturaBuilder");
const boletaBuilder  = require("../../../external_services/sunat/xmlBuilders/boletaBuilder");
const xmlSigner      = require("../../../external_services/sunat/xmlSigner");
const storageHelper  = require("../../../external_services/sunat/storageHelper");
const qrGenerator    = require("../../../external_services/sunat/qrGenerator");
const pdfGenerator   = require("../../../external_services/sunat/pdfGenerator");

const { encolarEnvio } = require("../../../queues/sunatQueue");
const cdrParser = require("../../../external_services/sunat/cdrParser");
const { Op } = require("sequelize");

// Estados desde los que se puede reintentar el envío (si además es_terminal=false)
const ESTADOS_REENVIABLES = ["RECHAZADO", "ERROR_RED", "SIN_CDR", "OBSERVADO", "FIRMADO", "GENERADO"];

/**
 * GET /comprobante/lista
 */
const listComprobantes = async (req, res) => {
  try {
    const { tipo, fecha } = req.query;
    const where = {};
    if (tipo)  where.tipo_comprobante_id = tipo;
    if (fecha) where.fecha_emision = fecha;

    const comprobantes = await Comprobante.findAll({
      where,
      include: [
        { model: Emisor,          attributes: ["ruc", "razon_social"] },
        { model: Cliente,         attributes: ["razon_social", "nrodoc", "tipo_documento_id"] },
        { model: TipoComprobante, attributes: ["descripcion"] },
        { model: Comprobante, as: "comprobanteRef", attributes: ["serie", "correlativo", "tipo_comprobante_id"] },
      ],
      order: [["id", "DESC"]],
    });
    return res.json(comprobantes);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * POST /comprobante/emitir
 *
 * Genera y firma el XML, luego lo encola para envío asíncrono a SUNAT.
 * Retorna 202 inmediatamente — el estado final llega vía polling a /estado.
 */
const emitirComprobante = async (req, res) => {
  try {
    const { comprobante_id } = req.body;
    if (!comprobante_id) {
      return res.status(400).json({ message: "comprobante_id es requerido" });
    }

    const comprobante = await Comprobante.findByPk(comprobante_id, {
      include: [
        { model: Emisor },
        { model: Cliente, include: [{ model: TipoDocumento }] },
        { model: Detalle, include: [{ model: Producto, include: [TipoAfectacion, Unidad] }] },
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

    if (comprobante.estado_sunat === "ACEPTADO") {
      return res.status(400).json({
        message: "El comprobante ya fue aceptado por SUNAT",
        estado_sunat: "ACEPTADO",
      });
    }

    if (comprobante.estado_sunat === "ENVIANDO") {
      return res.status(409).json({
        message: "El comprobante ya está siendo procesado",
        estado_sunat: "ENVIANDO",
      });
    }

    const tiposPermitidos = ["01", "03", "07", "08"];
    if (!tiposPermitidos.includes(comprobante.tipo_comprobante_id)) {
      return res.status(400).json({
        message: `Tipo ${comprobante.tipo_comprobante_id} no soportado. Use /guia/emitir para guías.`,
      });
    }

    if (!comprobante.Emisor) {
      return res.status(400).json({ message: "El comprobante no tiene emisor asignado" });
    }

    // Validar certificado antes de intentar firmar
    const certPath     = process.env.SUNAT_CERT_PATH;
    const certPassword = process.env.SUNAT_CERT_PASSWORD;
    if (!certPath || !certPassword) {
      return res.status(500).json({ message: "Certificado digital no configurado (SUNAT_CERT_PATH / SUNAT_CERT_PASSWORD)" });
    }

    // Construir nombre del archivo
    const correlativoStr = String(comprobante.correlativo).padStart(8, "0");
    const nombreArchivo  = `${comprobante.Emisor.ruc}-${comprobante.tipo_comprobante_id}-${comprobante.serie}-${correlativoStr}`;

    // Generar XML según tipo → estado GENERADO
    let xmlSinFirmar;
    if (comprobante.tipo_comprobante_id === "01") {
      xmlSinFirmar = facturaBuilder.build(comprobante);
    } else if (comprobante.tipo_comprobante_id === "03") {
      xmlSinFirmar = boletaBuilder.build(comprobante);
    } else {
      xmlSinFirmar = facturaBuilder.buildNota(comprobante);
    }

    await comprobante.update({ estado_sunat: "GENERADO", nombre_xml: nombreArchivo, xml_path: nombreArchivo });

    // Firmar XML → estado FIRMADO
    let xmlFirmado;
    try {
      xmlFirmado = xmlSigner.signXml(xmlSinFirmar, certPath, certPassword);
    } catch (signErr) {
      return res.status(500).json({ message: "Error al firmar el XML: " + signErr.message });
    }

    storageHelper.saveXml(nombreArchivo, xmlFirmado);
    await comprobante.update({ estado_sunat: "FIRMADO" });

    // Encolar envío a SUNAT
    const job = await encolarEnvio(comprobante_id, nombreArchivo);

    return res.status(202).json({
      message:       "Comprobante firmado y en cola de envío a SUNAT",
      comprobante_id,
      estado_sunat:  "FIRMADO",
      nombre_xml:    nombreArchivo,
      job_id:        job.id,
      estado_url:    `/comprobante/${comprobante_id}/estado`,
    });
  } catch (err) {
    console.error("emitirComprobante error:", err);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * POST /comprobante/:id/reenviar
 *
 * Reencola un comprobante en estado reenviable.
 * Bloquea si es_terminal=true (rechazo de datos, no hay reenvío útil sin corregir XML).
 */
const reenviarComprobante = async (req, res) => {
  try {
    const comprobante = await Comprobante.findByPk(req.params.id, {
      include: [Emisor],
    });

    if (!comprobante) {
      return res.status(404).json({ message: "Comprobante no encontrado" });
    }

    if (comprobante.estado_sunat === "ACEPTADO" || comprobante.estado_sunat === "OBSERVADO") {
      return res.status(400).json({ message: "El comprobante ya fue aceptado por SUNAT" });
    }

    if (comprobante.estado_sunat === "ENVIANDO") {
      return res.status(409).json({ message: "El comprobante ya está siendo procesado" });
    }

    if (comprobante.estado_sunat === "FUERA_PLAZO") {
      return res.status(400).json({ message: "El comprobante está fuera del plazo permitido (>3 días)" });
    }

    if (comprobante.es_terminal) {
      return res.status(400).json({
        message: "El comprobante fue rechazado definitivamente por SUNAT. Corrija los datos del XML antes de reenviar.",
        estado_sunat: comprobante.estado_sunat,
        mensaje_sunat: comprobante.mensaje_sunat,
      });
    }

    if (!ESTADOS_REENVIABLES.includes(comprobante.estado_sunat)) {
      return res.status(400).json({
        message: `No se puede reenviar en estado ${comprobante.estado_sunat}`,
      });
    }

    const archivoXml = comprobante.xml_path || comprobante.nombre_xml;
    if (!archivoXml || !storageHelper.existsXml(archivoXml)) {
      return res.status(400).json({
        message: "XML firmado no encontrado en disco. Use /comprobante/emitir para regenerarlo.",
      });
    }

    const job = await encolarEnvio(comprobante.id, archivoXml);

    return res.json({
      message:        "Comprobante reingresado a la cola de envío",
      comprobante_id: comprobante.id,
      estado_sunat:   "ENVIANDO",
      job_id:         job?.id ?? null,
      estado_url:     `/comprobante/${comprobante.id}/estado`,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * POST /admin/recuperar-estados
 *
 * Utilidad de recuperación única: corrige estados inconsistentes en registros
 * históricos (CDR no parseado, errores transitorios mal clasificados, etc.).
 */
const recuperarEstados = async (_req, res) => {
  const log = [];
  let corregidos = 0;

  try {
    // ── 1. SIN_CDR con CDR base64 real → re-parsear ──────────────────
    const sinCdrConDatos = await Comprobante.findAll({
      where: {
        estado_sunat: "SIN_CDR",
        cdr_xml: { [Op.like]: "UEsD%" }, // Magic bytes de ZIP en base64
      },
    });

    for (const c of sinCdrConDatos) {
      try {
        const cdr = cdrParser.parseCdr(c.cdr_xml);
        const code = parseInt(cdr.responseCode, 10);
        const estadoFinal = cdr.responseCode === "0" ? "ACEPTADO"
          : (code >= 2000 && code <= 3999) ? "OBSERVADO"
          : "RECHAZADO";
        const esTerminal = estadoFinal === "ACEPTADO" || estadoFinal === "OBSERVADO";

        await c.update({
          estado_sunat: estadoFinal,
          es_terminal:  esTerminal,
          cdr_code:     cdr.responseCode,
          cdr_xml:      cdr.xmlContent,
          hash:         cdr.digestValue,
          mensaje_sunat: cdr.description + (cdr.notes.length ? " | " + cdr.notes.join(" | ") : ""),
        });

        log.push({ id: c.id, accion: `SIN_CDR → ${estadoFinal} (CDR re-parseado)` });
        corregidos++;
      } catch (parseErr) {
        log.push({ id: c.id, accion: `SIN_CDR — CDR aún no parseable: ${parseErr.message}` });
      }
    }

    // ── 2. RECHAZADO/ERROR_RED con error transitorio (0140, red) ─────
    const erroresTransitorios = await Comprobante.findAll({
      where: {
        estado_sunat: { [Op.in]: ["RECHAZADO", "ERROR_RED"] },
        es_terminal:  false,
        [Op.or]: [
          { mensaje_sunat: { [Op.iLike]: "%en proceso%"         } },
          { mensaje_sunat: { [Op.iLike]: "%vuelva intentarlo%"  } },
          { mensaje_sunat: { [Op.iLike]: "%no puede responder%"  } },
          { mensaje_sunat: { [Op.iLike]: "%servicio%no está disponible%" } },
        ],
      },
    });

    for (const c of erroresTransitorios) {
      await c.update({
        estado_sunat: "ERROR_RED",
        es_terminal:  false,
        cdr_xml:      null, // limpiar si estaba contaminado
      });
      log.push({ id: c.id, accion: `${c.estado_sunat} → ERROR_RED (error transitorio, listo para reenviar)` });
      corregidos++;
    }

    // ── 3. ERROR_RED con cdr_xml contaminado (no es base64 ZIP) ──────
    const cdrContaminado = await Comprobante.findAll({
      where: {
        estado_sunat: "ERROR_RED",
        cdr_xml: { [Op.not]: null, [Op.notLike]: "UEsD%" },
      },
    });

    for (const c of cdrContaminado) {
      await c.update({ cdr_xml: null });
      log.push({ id: c.id, accion: "ERROR_RED — cdr_xml contaminado limpiado" });
      corregidos++;
    }

    return res.json({
      message:    `Recuperación completada. ${corregidos} registro(s) corregido(s).`,
      corregidos,
      detalle:    log,
    });
  } catch (err) {
    console.error("recuperarEstados error:", err);
    return res.status(500).json({ message: err.message, detalle: log });
  }
};

/**
 * GET /comprobante/:id/estado
 * Retorna el estado actual del comprobante (usado para polling desde el frontend).
 */
const consultarEstado = async (req, res) => {
  try {
    const comprobante = await Comprobante.findByPk(req.params.id, {
      attributes: [
        "id", "serie", "correlativo", "tipo_comprobante_id",
        "estado_sunat", "es_terminal", "cdr_code", "cdr_xml", "hash", "enviado_at",
        "codigo_sunat", "mensaje_sunat", "hash_cpe",
        "nombre_xml", "xml_path", "fecha_envio_sunat", "intentos_envio",
      ],
    });

    if (!comprobante) return res.status(404).json({ message: "Comprobante no encontrado" });

    return res.json(comprobante);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * GET /comprobante/:id/pdf
 */
const descargarPdf = async (req, res) => {
  try {
    const format = req.query.format || "a5";

    const comprobante = await Comprobante.findByPk(req.params.id, {
      include: [
        Emisor,
        { model: Cliente, include: [TipoDocumento] },
        { model: Detalle, include: [{ model: Producto, include: [Unidad] }] },
        TipoComprobante,
        Moneda,
      ],
    });

    if (!comprobante) return res.status(404).json({ message: "Comprobante no encontrado" });
    if (!comprobante.nombre_xml) {
      return res.status(400).json({ message: "El comprobante aún no fue emitido." });
    }

    let qrBase64 = "";
    try {
      qrBase64 = await qrGenerator.generarQr(comprobante, comprobante.hash || comprobante.hash_cpe);
    } catch (_) { /* continúa sin QR */ }

    const pdfBuffer = await pdfGenerator.generarPdf(comprobante, qrBase64, format);

    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", `inline; filename="${comprobante.nombre_xml}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * GET /comprobante/:id/xml
 */
const descargarXml = async (req, res) => {
  try {
    const comprobante = await Comprobante.findByPk(req.params.id, {
      attributes: ["id", "nombre_xml", "xml_path"],
    });

    if (!comprobante) return res.status(404).json({ message: "Comprobante no encontrado" });

    const archivo = comprobante.xml_path || comprobante.nombre_xml;
    if (!archivo || !storageHelper.existsXml(archivo)) {
      return res.status(404).json({ message: "XML no disponible. El comprobante aún no fue emitido." });
    }

    return res.download(storageHelper.getXmlPath(archivo), `${archivo}.xml`);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  listComprobantes,
  emitirComprobante,
  reenviarComprobante,
  consultarEstado,
  descargarPdf,
  descargarXml,
  recuperarEstados,
};
