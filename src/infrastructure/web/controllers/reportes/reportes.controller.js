"use strict";

/**
 * REPORTE DE DOCUMENTOS ELECTRÓNICOS SUNAT
 *
 * Lista, en un rango de fechas, los documentos que SUNAT aceptó: facturas,
 * boletas, notas de crédito/débito (tabla Comprobante) y guías de remisión
 * remitente/transportista (tabla GuiaRemision).
 *
 * El filtro de estado NO lo controla el cliente: el reporte es, por definición,
 * de documentos aceptados. Los anulados por comunicación de baja se excluyen
 * salvo que se pidan explícitamente, y en ese caso viajan marcados.
 */

const { Op, fn, col, literal, where: sqlWhere } = require("sequelize");

const Comprobante             = require("../../../database/models/facturacion/comprobante");
const GuiaRemision            = require("../../../database/models/facturacion/guiaremision");
const Cliente                 = require("../../../database/models/facturacion/cliente");
const ComunicacionBaja        = require("../../../database/models/facturacion/comunicacionbaja");
const ComunicacionBajaDetalle = require("../../../database/models/facturacion/comunicacionbajadetalle");
const EnvioResumen            = require("../../../database/models/facturacion/envioresumen");
const EnvioResumenDetalle     = require("../../../database/models/facturacion/envioresumendetalle");
require("../../../database/models/facturacion/asociation");

// Formatos que vienen de la tabla Comprobante.
const TIPOS_COMPROBANTE = {
  "01": "Factura",
  "03": "Boleta",
  "07": "Nota de Crédito",
  "08": "Nota de Débito",
};

// Formatos que vienen de la tabla GuiaRemision.
const TIPOS_GUIA = {
  "09": "Guía de Remisión Remitente",
  "31": "Guía de Remisión Transportista",
};

const TIPOS_VALIDOS = { ...TIPOS_COMPROBANTE, ...TIPOS_GUIA };

// Orden explícito: JS reordena las claves numéricas de un objeto ("31" es un
// índice de array válido y se adelantaría a "01"), y ese orden se filtra al
// mensaje de error y al listado por defecto.
const ORDEN_TIPOS = ["01", "03", "07", "08", "09", "31"];

// OBSERVADO entra como aceptado: SUNAT lo registró, solo dejó observaciones.
// Ver ESTADOS_REENVIABLES en sunat.controller.js.
const ESTADOS_ACEPTADOS_COMPROBANTE = ["ACEPTADO", "OBSERVADO"];

// La guía usa códigos de 2 letras: AC = recibida por SUNAT con ticket.
const ESTADO_ACEPTADO_GUIA = "AC";

const RANGO_MAX_DIAS = 366;
const MAX_FILAS      = 5000;
const LIMIT_DEFAULT  = 25;
const LIMIT_MAX      = 200;

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Devuelve la fecha local en formato YYYY-MM-DD.
 * en-CA produce ese formato directamente, sin el corrimiento de zona horaria
 * que introduce toISOString().
 */
const hoyLocal = () => new Date().toLocaleDateString("en-CA");

/** Primer día del mes en curso, en formato YYYY-MM-DD. */
const inicioDeMes = () => `${hoyLocal().slice(0, 7)}-01`;

/** Diferencia en días entre dos fechas YYYY-MM-DD. */
const diasEntre = (desde, hasta) =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);

/**
 * Normaliza el parámetro `tipos` (CSV) a la lista de códigos solicitados.
 * Vacío o ausente = todos los formatos.
 * @returns {string[]|null} null si contiene algún código no reconocido.
 */
const parseTipos = (raw) => {
  if (!raw) return [...ORDEN_TIPOS];

  const pedidos = String(raw)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!pedidos.length) return [...ORDEN_TIPOS];
  if (pedidos.some((t) => !TIPOS_VALIDOS[t])) return null;

  const unicos = new Set(pedidos);
  return ORDEN_TIPOS.filter((t) => unicos.has(t));
};

/**
 * Ids de comprobantes anulados ante SUNAT. Hay dos vías de anulación y ambas
 * cuentan, por eso no basta con mirar la comunicación de baja:
 *
 *  - Facturas, NC y ND → Comunicación de Baja (RA), procesada = estado_ticket "PR".
 *  - Boletas           → Resumen Diario (RC) con condicion = 3 (baja), estado_ticket "PR".
 *
 * @returns {Promise<Set<number>>}
 */
const obtenerAnulados = async () => {
  const [porBaja, porResumen] = await Promise.all([
    ComunicacionBajaDetalle.findAll({
      attributes: ["comprobante_id"],
      include: [{
        model: ComunicacionBaja,
        attributes: [],
        required: true,
        where: { estado_ticket: "PR" },
      }],
      raw: true,
    }),
    EnvioResumenDetalle.findAll({
      attributes: ["comprobante_id"],
      where: { condicion: 3 },
      include: [{
        model: EnvioResumen,
        attributes: [],
        required: true,
        where: { tipo: "RC", estado_ticket: "PR" },
      }],
      raw: true,
    }),
  ]);

  const anulados = new Set();
  for (const fila of [...porBaja, ...porResumen]) {
    if (fila.comprobante_id != null) anulados.add(fila.comprobante_id);
  }
  return anulados;
};

/** Filtro de búsqueda por cliente: razón social o número de documento. */
const whereCliente = (texto) => ({
  [Op.or]: [
    { razon_social: { [Op.iLike]: `%${texto}%` } },
    { nrodoc:       { [Op.iLike]: `%${texto}%` } },
  ],
});

/**
 * GET /reportes/documentos
 *
 * Query params:
 *   tipos             CSV de códigos (01,03,07,08,09,31). Vacío = todos.
 *   desde, hasta      YYYY-MM-DD, ambos inclusive.
 *   cliente           Texto libre: razón social o nro. de documento.
 *   serie             Serie exacta (F001, B001, T001…).
 *   incluir_anulados  "1" para traer también los dados de baja, marcados.
 *   page, limit       Paginación (limit por defecto 25, máximo 200).
 */
const listarDocumentos = async (req, res, next) => {
  try {
    const {
      tipos: tiposRaw,
      cliente,
      serie,
      incluir_anulados: incluirAnuladosRaw,
    } = req.query;

    // ── Validación de parámetros ──────────────────────────────────────────
    const tipos = parseTipos(tiposRaw);
    if (!tipos) {
      return res.status(400).json({
        message: `Tipo de documento no válido. Permitidos: ${ORDEN_TIPOS.join(", ")}`,
      });
    }

    const desde = req.query.desde || inicioDeMes();
    const hasta = req.query.hasta || hoyLocal();

    if (!RE_FECHA.test(desde) || !RE_FECHA.test(hasta)) {
      return res.status(400).json({ message: "Las fechas deben tener formato YYYY-MM-DD" });
    }
    if (desde > hasta) {
      return res.status(400).json({ message: "La fecha 'desde' no puede ser posterior a 'hasta'" });
    }
    if (diasEntre(desde, hasta) > RANGO_MAX_DIAS) {
      return res.status(400).json({ message: `El rango no puede superar ${RANGO_MAX_DIAS} días` });
    }

    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(LIMIT_MAX, Math.max(1, parseInt(req.query.limit, 10) || LIMIT_DEFAULT));
    const incluirAnulados = incluirAnuladosRaw === "1" || incluirAnuladosRaw === "true";

    const tiposComprobante = tipos.filter((t) => TIPOS_COMPROBANTE[t]);
    const tiposGuia        = tipos.filter((t) => TIPOS_GUIA[t]);

    // Solo hace falta consultar las bajas si hay comprobantes en juego:
    // las guías no tienen flujo de anulación en el sistema.
    const anulados = tiposComprobante.length ? await obtenerAnulados() : new Set();

    const documentos = [];

    // ── Comprobantes (01, 03, 07, 08) ─────────────────────────────────────
    if (tiposComprobante.length) {
      const where = {
        tipo_comprobante_id: { [Op.in]: tiposComprobante },
        estado_sunat:        { [Op.in]: ESTADOS_ACEPTADOS_COMPROBANTE },
        // fecha_emision es DATE (lleva hora): sin el cast a DATE se perderían
        // los documentos emitidos después de medianoche del último día.
        [Op.and]: [
          sqlWhere(fn("DATE", col("Comprobante.fecha_emision")), { [Op.between]: [desde, hasta] }),
        ],
      };
      if (serie) where.serie = serie;
      if (!incluirAnulados && anulados.size) where.id = { [Op.notIn]: [...anulados] };

      const filas = await Comprobante.findAll({
        // Atributos explícitos: el modelo incluye cdr_xml (TEXT con el CDR en
        // base64) y no tiene sentido traerlo en un listado.
        attributes: [
          "id", "tipo_comprobante_id", "serie", "correlativo",
          "total", "moneda_id", "nombre_xml",
          // TO_CHAR evita que el driver reinterprete la fecha con otra zona.
          [literal(`TO_CHAR("Comprobante"."fecha_emision", 'YYYY-MM-DD')`), "fecha_dia"],
        ],
        where,
        include: [{
          model: Cliente,
          attributes: ["razon_social", "nrodoc"],
          required: !!cliente,
          ...(cliente ? { where: whereCliente(cliente) } : {}),
        }],
        limit: MAX_FILAS + 1, // +1 para detectar truncamiento
        order: [["fecha_emision", "DESC"], ["id", "DESC"]],
      });

      for (const c of filas) {
        documentos.push({
          id:            c.id,
          tipo:          c.tipo_comprobante_id,
          tipo_label:    TIPOS_COMPROBANTE[c.tipo_comprobante_id],
          numero:        `${c.serie}-${String(c.correlativo).padStart(8, "0")}`,
          fecha_emision: c.get("fecha_dia"),
          cliente:       c.Cliente?.razon_social || "—",
          documento:     c.Cliente?.nrodoc || "",
          moneda:        c.moneda_id || "PEN",
          total:         c.total != null ? parseFloat(c.total) : null,
          nombre_xml:    c.nombre_xml,
          anulado:       anulados.has(c.id),
        });
      }
    }

    // ── Guías de remisión (09, 31) ────────────────────────────────────────
    if (tiposGuia.length) {
      const where = {
        tipo_guia:    { [Op.in]: tiposGuia },
        estado_sunat: ESTADO_ACEPTADO_GUIA,
        // fecha_emision es DATEONLY: la comparación directa ya es por día.
        fecha_emision: { [Op.between]: [desde, hasta] },
      };
      if (serie) where.serie = serie;

      const filas = await GuiaRemision.findAll({
        attributes: ["id", "tipo_guia", "serie", "correlativo", "fecha_emision", "nombre_xml"],
        where,
        include: [{
          model: Cliente,
          as: "Destinatario",
          attributes: ["razon_social", "nrodoc"],
          required: !!cliente,
          ...(cliente ? { where: whereCliente(cliente) } : {}),
        }],
        limit: MAX_FILAS + 1,
        order: [["fecha_emision", "DESC"], ["id", "DESC"]],
      });

      for (const g of filas) {
        documentos.push({
          id:            g.id,
          tipo:          g.tipo_guia,
          tipo_label:    TIPOS_GUIA[g.tipo_guia],
          numero:        `${g.serie}-${String(g.correlativo).padStart(8, "0")}`,
          fecha_emision: g.fecha_emision,
          cliente:       g.Destinatario?.razon_social || "—",
          documento:     g.Destinatario?.nrodoc || "",
          moneda:        null,
          total:         null, // la guía no lleva importe
          nombre_xml:    g.nombre_xml,
          anulado:       false, // no hay flujo de baja de guías
        });
      }
    }

    // ── Mezcla y paginación ───────────────────────────────────────────────
    // Las dos tablas se ordenan por separado en la BD, así que el orden final
    // se resuelve aquí sobre el conjunto ya acotado por el rango de fechas.
    documentos.sort((a, b) => {
      if (a.fecha_emision !== b.fecha_emision) return a.fecha_emision < b.fecha_emision ? 1 : -1;
      if (a.tipo !== b.tipo) return a.tipo < b.tipo ? -1 : 1;
      return a.numero < b.numero ? 1 : -1;
    });

    const truncado = documentos.length > MAX_FILAS;
    if (truncado) documentos.length = MAX_FILAS;

    const totalRegistros = documentos.length;
    const totalPaginas   = Math.max(1, Math.ceil(totalRegistros / limit));
    const inicio         = (page - 1) * limit;

    return res.json({
      documentos: documentos.slice(inicio, inicio + limit),
      paginacion: {
        page,
        limit,
        total_registros: totalRegistros,
        total_paginas:   totalPaginas,
      },
      filtros: { tipos, desde, hasta, incluir_anulados: incluirAnulados },
      // El frontend avisa al usuario de que debe acotar el rango.
      truncado,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { listarDocumentos, TIPOS_VALIDOS };
