"use strict";

const Comprobante    = require("../../../database/models/facturacion/comprobante");
const { registrar } = require("../../../../application/services/auditoria.service");
const Emisor         = require("../../../database/models/facturacion/emisor");
const Cliente        = require("../../../database/models/facturacion/cliente");
const TipoDocumento  = require("../../../database/models/facturacion/tipodocumento");
const Detalle        = require("../../../database/models/facturacion/detalles");
const Producto       = require("../../../database/models/facturacion/producto");
const Unidad         = require("../../../database/models/facturacion/unidad");
const TipoComprobante = require("../../../database/models/facturacion/tipocomprobante");
const Moneda         = require("../../../database/models/facturacion/moneda");

require("../../../database/models/facturacion/asociation");

const storageHelper  = require("../../../external_services/sunat/storageHelper");
const qrGenerator    = require("../../../external_services/sunat/qrGenerator");
const pdfGenerator   = require("../../../external_services/sunat/pdfGenerator");

const { encolarEnvio } = require("../../../queues/sunatQueue");
const cdrParser = require("../../../external_services/sunat/cdrParser");
const { CODIGOS_TERMINAL } = require("../../../external_services/sunat/sunatCodes");
const { Op } = require("sequelize");

// Estados desde los que se puede reintentar el envío.
// OBSERVADO ya no está: significa "aceptado con observaciones" (registrado en SUNAT).
const ESTADOS_REENVIABLES = ["RECHAZADO", "ERROR_RED", "SIN_CDR", "FIRMADO", "GENERADO"];

const { INCLUDE_XML, generarYFirmarXml } = require("../../../../application/services/firmaComprobante");

/**
 * GET /comprobante/lista
 */
const listComprobantes = async (req, res, next) => {
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
    return next(err);
  }
};

/**
 * POST /comprobante/emitir
 *
 * Genera y firma el XML, luego lo encola para envío asíncrono a SUNAT.
 * Retorna 202 inmediatamente — el estado final llega vía polling a /estado.
 */
const emitirComprobante = async (req, res, next) => {
  try {
    const { comprobante_id } = req.body;
    if (!comprobante_id) {
      return res.status(400).json({ message: "comprobante_id es requerido" });
    }

    const comprobante = await Comprobante.findByPk(comprobante_id, {
      include: INCLUDE_XML,
    });

    if (!comprobante) {
      return res.status(404).json({ message: "Comprobante no encontrado" });
    }

    if (comprobante.estado_sunat === "ACEPTADO" || comprobante.estado_sunat === "OBSERVADO") {
      return res.status(400).json({
        message: "El comprobante ya fue aceptado por SUNAT",
        estado_sunat: comprobante.estado_sunat,
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

    // Generar y firmar XML → estados GENERADO → FIRMADO
    let nombreArchivo;
    try {
      nombreArchivo = await generarYFirmarXml(comprobante);
    } catch (genErr) {
      return next(genErr);
    }

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
    return next(err);
  }
};

/**
 * POST /comprobante/:id/reenviar
 *
 * Reencola un comprobante en estado reenviable.
 * Si fue RECHAZADO (o el XML no está en disco), regenera y re-firma el XML
 * desde la BD para que el reenvío tome los datos/builders corregidos.
 * Solo bloquea los rechazos realmente irrecuperables (CODIGOS_TERMINAL).
 */
const reenviarComprobante = async (req, res, next) => {
  try {
    const comprobante = await Comprobante.findByPk(req.params.id, {
      include: INCLUDE_XML,
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

    // Irrecuperables: numeración ya registrada, comprobante de baja, etc.
    // El resto de rechazos sí se puede reenviar porque el XML se regenera.
    const codigoNumerico = String(comprobante.cdr_code || "").replace(/[^\d]/g, "");
    if (comprobante.es_terminal && CODIGOS_TERMINAL.has(codigoNumerico)) {
      return res.status(400).json({
        message: "El comprobante fue rechazado definitivamente por SUNAT y no puede reenviarse.",
        estado_sunat: comprobante.estado_sunat,
        mensaje_sunat: comprobante.mensaje_sunat,
      });
    }

    if (!ESTADOS_REENVIABLES.includes(comprobante.estado_sunat)) {
      return res.status(400).json({
        message: `No se puede reenviar en estado ${comprobante.estado_sunat}`,
      });
    }

    // RECHAZADO → regenerar siempre (el XML anterior fue el rechazado).
    // Otros estados → regenerar solo si el XML firmado no está en disco.
    let archivoXml = comprobante.xml_path || comprobante.nombre_xml;
    const debeRegenerar =
      comprobante.estado_sunat === "RECHAZADO" ||
      !archivoXml ||
      !storageHelper.existsXml(archivoXml);

    if (debeRegenerar) {
      try {
        archivoXml = await generarYFirmarXml(comprobante);
      } catch (genErr) {
        return next(genErr);
      }
    }

    const job = await encolarEnvio(comprobante.id, archivoXml);
    registrar(req, "comprobante_reenviado", {
      entidad: "Comprobante",
      entidad_id: comprobante.id,
      antes: { estado_sunat: comprobante.estado_sunat, cdr_code: comprobante.cdr_code },
      despues: { xml_regenerado: debeRegenerar },
    });

    return res.json({
      message:        "Comprobante reingresado a la cola de envío",
      comprobante_id: comprobante.id,
      estado_sunat:   "ENVIANDO",
      job_id:         job?.id ?? null,
      estado_url:     `/comprobante/${comprobante.id}/estado`,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /admin/recuperar-estados
 *
 * Utilidad de recuperación única: corrige estados inconsistentes en registros
 * históricos (CDR no parseado, errores transitorios mal clasificados, etc.).
 */
const recuperarEstados = async (_req, res, next) => {
  const log = [];
  let corregidos = 0;

  try {
    // ── 0. OBSERVADO con cdr_code de rechazo (2000-3999) → RECHAZADO ──
    // Clasificación histórica invertida: SUNAT rechaza con códigos 2000-3999
    // (p.ej. 3168). Esos comprobantes nunca quedaron registrados en SUNAT y
    // deben quedar reenviables (el reenvío regenera el XML).
    const observadosInvertidos = await Comprobante.findAll({
      where: { estado_sunat: "OBSERVADO" },
    });

    for (const c of observadosInvertidos) {
      const code = parseInt(c.cdr_code, 10);
      if (Number.isInteger(code) && code >= 2000 && code <= 3999) {
        await c.update({ estado_sunat: "RECHAZADO", es_terminal: false });
        log.push({ id: c.id, accion: `OBSERVADO (${c.cdr_code}) → RECHAZADO reenviable` });
        corregidos++;
      }
    }

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
        const estadoFinal = cdrParser.resolverEstadoCdr(cdr);
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
    return next(err);
  }
};

/**
 * GET /comprobante/:id/estado
 * Retorna el estado actual del comprobante (usado para polling desde el frontend).
 */
const consultarEstado = async (req, res, next) => {
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
    return next(err);
  }
};

/**
 * GET /comprobante/:id/pdf
 */
const descargarPdf = async (req, res, next) => {
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
    return next(err);
  }
};

/**
 * GET /comprobante/:id/xml
 */
const descargarXml = async (req, res, next) => {
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
    return next(err);
  }
};

/**
 * GET /comprobante/:id/cdr
 * Descarga el CDR (ZIP de SUNAT) guardado en disco.
 */
const descargarCdr = async (req, res, next) => {
  try {
    const comprobante = await Comprobante.findByPk(req.params.id, {
      attributes: ["id", "nombre_xml", "xml_path"],
    });
    if (!comprobante) return res.status(404).json({ message: "Comprobante no encontrado" });

    const archivo = comprobante.xml_path || comprobante.nombre_xml;
    if (!archivo || !storageHelper.existsCdr(archivo)) {
      return res.status(404).json({ message: "CDR no disponible para este comprobante" });
    }
    return res.download(storageHelper.getCdrPath(archivo), `R-${archivo}.zip`);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listComprobantes,
  emitirComprobante,
  reenviarComprobante,
  consultarEstado,
  descargarPdf,
  descargarXml,
  descargarCdr,
  recuperarEstados,
};
