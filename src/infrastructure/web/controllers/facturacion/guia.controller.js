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
const sunatRestClient = require("../../../external_services/sunat/sunatRestClient");
const cdrParser = require("../../../external_services/sunat/cdrParser");
const pdfGenerator = require("../../../external_services/sunat/pdfGenerator");
const storageHelper = require("../../../external_services/sunat/storageHelper");
const sequelize = require("../../../database/database");
const { encolarConsultaGuia } = require("../../../queues/sunatQueue");
const { ValidationError, NotFoundError, ConflictError } = require("../../../utils/errors");

const TIPOS_GUIA = ["09", "31"];
// Campos que decide el servidor: el cliente no puede fijarlos al crear la guía.
const CAMPOS_PROTEGIDOS = new Set([
  "id", "serie", "correlativo", "estado_sunat", "codigo_sunat", "mensaje_sunat",
  "hash_cpe", "nombre_xml", "fecha_envio_sunat", "intentos_envio", "ticket",
]);
// Se puede (re)emitir una guía pendiente o rechazada; no una enviada o aceptada.
const ESTADOS_EMITIBLES = ["PE", "RR"];

/**
 * GET /guia
 * Lista guías de remisión con filtro opcional por fecha.
 */
const listGuias = async (req, res, next) => {
  try {
    const { fecha } = req.query;
    const where = {};
    if (fecha) where.fecha_emision = fecha;

    const guias = await GuiaRemision.findAll({
      where,
      include: [
        { model: Emisor, attributes: ["ruc", "razon_social"] },
        { model: Cliente, as: "Destinatario", attributes: ["razon_social", "nrodoc", "tipo_documento_id"] },
      ],
      order: [["id", "DESC"]],
    });
    return res.json(guias);
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /guia
 * Crea la cabecera de la guía. El número lo asigna el servidor: bloquea la
 * fila de la serie (SELECT ... FOR UPDATE), toma su correlativo y la avanza.
 * Body: datos de la guía + serie_id (se ignoran serie/correlativo/estado enviados).
 */
const createGuia = async (req, res, next) => {
  try {
    const { serie_id, ...resto } = req.body || {};
    if (!serie_id) throw new ValidationError("serie_id es requerido");
    if (!TIPOS_GUIA.includes(resto.tipo_guia)) throw new ValidationError("tipo_guia debe ser 09 o 31");
    const datos = Object.fromEntries(Object.entries(resto).filter(([k]) => !CAMPOS_PROTEGIDOS.has(k)));

    const guia = await sequelize.transaction(async (transaction) => {
      const serie = await Serie.findByPk(serie_id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!serie) throw new NotFoundError("Serie no encontrada");
      if (serie.tipo_comprobante_id !== datos.tipo_guia) {
        throw new ValidationError(`La serie ${serie.serie} no corresponde a guías tipo ${datos.tipo_guia}`);
      }
      const correlativo = serie.correlativo || 1;
      await serie.update({ correlativo: correlativo + 1 }, { transaction });
      return GuiaRemision.create(
        { ...datos, serie: serie.serie, correlativo, estado_sunat: "PE" },
        { transaction }
      );
    });
    return res.status(201).json(guia);
  } catch (err) {
    return next(err);
  }
};

/** POST /guia/detalle — solo mientras la guía no se haya enviado. */
const createDetalleGuia = async (req, res, next) => {
  try {
    const { guia_id } = req.body || {};
    const guia = await GuiaRemision.findByPk(guia_id, { attributes: ["id", "estado_sunat"] });
    if (!guia) throw new NotFoundError("Guía no encontrada");
    if (guia.estado_sunat !== "PE") throw new ConflictError("La guía ya fue enviada; no se le pueden agregar ítems");
    const { id: _id, ...datos } = req.body;
    const detalle = await DetalleGuia.create(datos);
    return res.status(201).json(detalle);
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /guia/emitir
 * Body: { guia_id }
 *
 * Emite una Guía de Remisión Remitente (09) o Transportista (31) a SUNAT.
 */
const emitirGuia = async (req, res, next) => {
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
    if (!ESTADOS_EMITIBLES.includes(guia.estado_sunat)) {
      return res.status(409).json({
        message: guia.estado_sunat === "AC"
          ? "La guía ya fue aceptada por SUNAT"
          : "La guía ya fue enviada y se está esperando la respuesta de SUNAT",
        estado_sunat: guia.estado_sunat,
      });
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
      return next(signErr);
    }

    storageHelper.saveXml(nombreArchivo, xmlFirmado);

    // Enviar a SUNAT (WS de guías, REST ASÍNCRONO)
    let restResponse;
    try {
      const xmlBuffer = Buffer.from(xmlFirmado, "utf8");
      restResponse = await sunatRestClient.sendGuiaRest(xmlBuffer, nombreArchivo, emisor);
    } catch (restErr) {
      const codigoErr = restErr.sunatCode || "REST_ERR";
      const mensajeErr = restErr.sunatMessage || restErr.message;
      const erroresDetalle = restErr.sunatErrors || [];

      await guia.update({
        estado_sunat: "RR",
        codigo_sunat: codigoErr,
        mensaje_sunat: String(restErr.message).substring(0, 500),
        nombre_xml: nombreArchivo,
        fecha_envio_sunat: new Date(),
        intentos_envio: (guia.intentos_envio || 0) + 1,
      });

      return res.status(422).json({
        message: "SUNAT rechazó la guía",
        codigo_sunat: codigoErr,
        mensaje_sunat: mensajeErr,
        errores: erroresDetalle,
        error: restErr.message,
      });
    }

    const ticket = restResponse?.numTicket || restResponse?.ticket;
    if (!ticket) {
      await guia.update({
        estado_sunat: "RR",
        codigo_sunat: "SIN_TICKET",
        mensaje_sunat: "SUNAT no devolvió ticket de recepción",
        nombre_xml: nombreArchivo,
        fecha_envio_sunat: new Date(),
        intentos_envio: (guia.intentos_envio || 0) + 1,
      });
      return res.status(502).json({ message: "SUNAT no devolvió ticket de recepción", estado_sunat: "RR" });
    }

    // Recibida, NO aceptada: el resultado llega al consultar el ticket (guiaWorker).
    await guia.update({
      estado_sunat: "EN",
      ticket: String(ticket),
      codigo_sunat: "TICKET",
      mensaje_sunat: `Enviada a SUNAT (ticket ${ticket}), esperando respuesta`,
      nombre_xml: nombreArchivo,
      fecha_envio_sunat: new Date(),
      intentos_envio: (guia.intentos_envio || 0) + 1,
    });
    await encolarConsultaGuia(guia.id);

    return res.status(202).json({
      guia_id: guia.id,
      nombre_xml: nombreArchivo,
      ticket,
      estado_sunat: "EN",
      message: "Guía recibida por SUNAT; el resultado se consulta automáticamente",
      estado_url: `/guia/${guia.id}/estado`,
      pdf_url: `/guia/${guia.id}/pdf`,
      xml_url: `/guia/${guia.id}/xml`,
    });
  } catch (err) {
    console.error("emitirGuia error:", err);
    return next(err);
  }
};

/**
 * GET /guia/:id/estado
 */
const consultarEstadoGuia = async (req, res, next) => {
  try {
    const guia = await GuiaRemision.findByPk(req.params.id, {
      attributes: ["id", "serie", "correlativo", "tipo_guia", "estado_sunat", "codigo_sunat", "mensaje_sunat", "hash_cpe", "nombre_xml", "fecha_envio_sunat", "ticket"],
    });
    if (!guia) return res.status(404).json({ message: "Guía no encontrada" });
    // Si la consulta automática se agotó (SUNAT tardó mucho), se vuelve a encolar.
    if (guia.estado_sunat === "EN" && guia.ticket) await encolarConsultaGuia(guia.id);
    return res.json(guia);
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /guia/:id/pdf
 * Genera y descarga el PDF de la guía de remisión.
 */
const descargarPdfGuia = async (req, res, next) => {
  try {
    const guia = await GuiaRemision.findByPk(req.params.id, {
      include: [
        Emisor,
        { model: Cliente, as: "Destinatario" },
        { model: DetalleGuia, include: [{ model: Unidad }] },
      ],
    });
    if (!guia) return res.status(404).json({ message: "Guía no encontrada" });
    if (!guia.nombre_xml) return res.status(400).json({ message: "La guía no tiene XML generado aún" });

    const pdfBuffer = await pdfGenerator.generarPdfGuia(guia);

    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", `inline; filename="${guia.nombre_xml}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /guia/:id/xml
 */
const descargarXmlGuia = async (req, res, next) => {
  try {
    const guia = await GuiaRemision.findByPk(req.params.id, { attributes: ["id", "nombre_xml"] });
    if (!guia) return res.status(404).json({ message: "Guía no encontrada" });
    if (!guia.nombre_xml || !storageHelper.existsXml(guia.nombre_xml)) {
      return res.status(404).json({ message: "XML no disponible" });
    }
    return res.download(storageHelper.getXmlPath(guia.nombre_xml), `${guia.nombre_xml}.xml`);
  } catch (err) {
    return next(err);
  }
};

module.exports = { listGuias, createGuia, createDetalleGuia, emitirGuia, consultarEstadoGuia, descargarPdfGuia, descargarXmlGuia };
