const { Op, UniqueConstraintError } = require("sequelize");
const { registrar } = require("../../../../application/services/auditoria.service");
const sequelize = require("../../../database/database");
const { hoyLocal, horaLocal } = require("../../../utils/fecha");
const AperturaCaja = require("../../../database/models/caja/aperturaCaja");
const { calcularDesglose } = require("../../../../application/services/caja.service");
const Ticket = require("../../../database/models/Tickets/tickets");
const Comprobante = require("../../../database/models/facturacion/comprobante");
const Cliente = require("../../../database/models/facturacion/cliente");
require("../../../database/models/facturacion/asociation");

// ─── Caja ─────────────────────────────────────────────────────────────────────
// Los totales se calculan por caja_id en caja.service (ver ese archivo).

/**
 * Abre la caja. Solo puede haber una abierta: la BD lo garantiza con el
 * índice único caja_una_abierta (dos aperturas simultáneas → la segunda falla).
 * Body: { monto_apertura, observacion }
 */
const abrirCaja = async (req, res, next) => {
  try {
    const { monto_apertura, observacion } = req.body || {};
    const monto = parseFloat(monto_apertura);
    if (monto_apertura === undefined || monto_apertura === "" || isNaN(monto) || monto < 0) {
      return res.status(400).json({ message: "El monto de apertura es requerido y no puede ser negativo" });
    }

    const caja = await AperturaCaja.create({
      fecha_apertura: hoyLocal(),
      hora_apertura: horaLocal(),
      monto_apertura: monto,
      estado: "abierta",
      observacion: observacion ? String(observacion).slice(0, 250) : null,
      usuario_apertura_id: req.user?.id ?? null,
    });
    registrar(req, "caja_abierta", { entidad: "AperturaCajas", entidad_id: caja.id, despues: { monto_apertura: monto } });
    res.json(caja);
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({ message: "Ya hay una caja abierta. Ciérrela antes de abrir una nueva." });
    }
    next(error);
  }
};

/**
 * Caja abierta y su desglose en vivo.
 * Mantiene los campos que ya usa el frontend (ventas_tickets, total_efectivo…)
 * y agrega `desglose` (por método, crédito y pendientes SUNAT).
 */
const getCajaActual = async (_req, res, next) => {
  try {
    const caja = await AperturaCaja.findOne({ where: { estado: "abierta" } });
    if (!caja) {
      return res.json({ caja: null, ventas_tickets: 0, ventas_comprobantes: 0, total_ventas_preview: 0 });
    }
    const d = await calcularDesglose(caja);
    res.json({
      caja,
      ventas_tickets: d.ventas_tickets,
      ventas_comprobantes: d.ventas_comprobantes,
      total_ventas_preview: d.total_cobrado,
      total_efectivo: d.total_efectivo,
      total_yape: d.total_yape,
      efectivo_esperado: d.efectivo_esperado,
      desglose: d,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cierra la caja: diferencia = efectivo contado − (apertura + efectivo neto).
 * En una transacción con la caja bloqueada (FOR UPDATE): ninguna venta puede
 * asignarse a ella mientras se cierra. El desglose queda congelado en JSONB.
 * Params: { id }; Body: { monto_cierre_fisico, observacion }
 */
const cerrarCaja = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { monto_cierre_fisico, observacion } = req.body || {};
    const montoCierre = parseFloat(monto_cierre_fisico);
    if (monto_cierre_fisico === undefined || monto_cierre_fisico === "" || isNaN(montoCierre) || montoCierre < 0) {
      return res.status(400).json({ message: "El monto de cierre es requerido y no puede ser negativo" });
    }

    const resultado = await sequelize.transaction(async (transaction) => {
      const caja = await AperturaCaja.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!caja) return { status: 404, body: { message: "Caja no encontrada" } };
      if (caja.estado === "cerrada") return { status: 400, body: { message: "La caja ya está cerrada" } };

      const d = await calcularDesglose(caja, transaction);
      const diferencia = Math.round((montoCierre - d.efectivo_esperado) * 100) / 100;

      await caja.update({
        estado: "cerrada",
        monto_cierre_fisico: montoCierre,
        total_ventas: d.total_cobrado,
        total_efectivo: d.total_efectivo,
        total_yape: d.total_yape,
        diferencia,
        observacion: observacion ? String(observacion).slice(0, 250) : caja.observacion,
        usuario_cierre_id: req.user?.id ?? null,
        cerrada_at: new Date(),
        desglose: d,
      }, { transaction });
      await registrar(req, "caja_cerrada", {
        entidad: "AperturaCajas",
        entidad_id: caja.id,
        despues: { monto_cierre_fisico: montoCierre, efectivo_esperado: d.efectivo_esperado, diferencia },
        transaction,
      });

      return {
        status: 200,
        body: {
          caja,
          ventas_tickets: d.ventas_tickets,
          ventas_comprobantes: d.ventas_comprobantes,
          total_ventas: d.total_cobrado,
          total_efectivo: d.total_efectivo,
          total_yape: d.total_yape,
          efectivo_esperado: d.efectivo_esperado,
          diferencia,
          desglose: d,
        },
      };
    });
    res.status(resultado.status).json(resultado.body);
  } catch (error) {
    next(error);
  }
};

/** Últimas 30 aperturas/cierres (incluye el desglose congelado de cada cierre). */
const getHistorialCaja = async (_req, res, next) => {
  try {
    const historial = await AperturaCaja.findAll({
      order: [["id", "DESC"]],
      limit: 30,
    });
    res.json(historial);
  } catch (error) {
    next(error);
  }
};

// ─── GET /ventas/dia ──────────────────────────────────────────────────────────

const getVentasDia = async (req, res, next) => {
  try {
    const fecha = req.query.fecha || hoyLocal();
    const tipo = req.query.tipo || "all"; // all | ticket | boleta | factura

    const resultado = [];

    // Tickets — usamos DATE() para comparar solo la fecha (sin timezone)
    if (tipo === "all" || tipo === "ticket") {
      const tickets = await Ticket.findAll({
        where: sequelize.where(
          sequelize.fn("DATE", sequelize.col("fechaEmision")),
          fecha
        ),
        order: [["createdAt", "DESC"]],
      });
      for (const t of tickets) {
        resultado.push({
          id: t.id,
          tipo: "ticket",
          numero: `T-${String(t.id).padStart(6, "0")}`,
          cliente: t.cliente || "Sin nombre",
          documento: t.numeroDocumento || "",
          fecha: t.fechaEmision,
          total: parseFloat(t.precioTotal || 0),
          estado: null,
        });
      }
    }

    // Comprobantes (Boletas y Facturas)
    if (tipo === "all" || tipo === "boleta" || tipo === "factura") {
      const tipoFilter = [];
      if (tipo === "all" || tipo === "boleta") tipoFilter.push("03");
      if (tipo === "all" || tipo === "factura") tipoFilter.push("01");

      const comprobantes = await Comprobante.findAll({
        where: {
          [Op.and]: [
            sequelize.where(sequelize.fn("DATE", sequelize.col("fecha_emision")), fecha),
            { tipo_comprobante_id: { [Op.in]: tipoFilter } },
          ],
        },
        include: [{ model: Cliente, attributes: ["razon_social", "nrodoc"] }],
        order: [["fecha_emision", "DESC"]],
      });

      for (const c of comprobantes) {
        const esBoleta = c.tipo_comprobante_id === "03";
        resultado.push({
          id: c.id,
          tipo: esBoleta ? "boleta" : "factura",
          numero: `${c.serie}-${String(c.correlativo).padStart(5, "0")}`,
          cliente: c.Cliente?.razon_social || "Sin nombre",
          documento: c.Cliente?.nrodoc || "",
          fecha: c.fecha_emision,
          total: parseFloat(c.total || 0),
          estado: c.estado_sunat,
          es_terminal: c.es_terminal || false,
          mensaje_sunat: c.mensaje_sunat || null,
        });
      }
    }

    // Ordenar por fecha descendente
    resultado.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    // Totales por tipo
    const totales = {
      tickets: resultado.filter((v) => v.tipo === "ticket").reduce((s, v) => s + v.total, 0),
      boletas: resultado.filter((v) => v.tipo === "boleta").reduce((s, v) => s + v.total, 0),
      facturas: resultado.filter((v) => v.tipo === "factura").reduce((s, v) => s + v.total, 0),
    };
    totales.general = totales.tickets + totales.boletas + totales.facturas;

    res.json({ ventas: resultado, totales });
  } catch (error) {
    next(error);
  }
};

module.exports = { abrirCaja, getCajaActual, cerrarCaja, getHistorialCaja, getVentasDia };
