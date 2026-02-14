const { Op } = require("sequelize");
const AperturaCaja = require("../../models/caja/aperturaCaja");
const Ticket = require("../../models/Tickets/tickets");
const Comprobante = require("../../models/facturacion/comprobante");
const Cliente = require("../../models/facturacion/cliente");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} CajaVentas
 * @property {number} ventas_tickets - Suma de ventas de tickets y almanaques.
 * @property {number} ventas_comprobantes - Suma de ventas de comprobantes (Facturas/Boletas).
 * @property {number} total - Suma total de todas las ventas.
 */

/**
 * Calcula el resumen de ventas (Tickets, Comprobantes, Almanaques) desde la apertura de una caja.
 * 
 * @param {Object} caja - Instancia del modelo AperturaCaja.
 * @returns {Promise<CajaVentas>} Resumen de ventas calculado.
 */
async function calcularVentas(caja) {
  const timestampDesde = caja.createdAt;
  const fechaDesde = caja.fecha_apertura;

  const [ventasTickets, ventasComprobantes, ventasAlmanaques] = await Promise.all([
    // Para Tickets usamos el timestamp exacto (createdAt)
    Ticket.sum("precioTotal", {
      where: { createdAt: { [Op.gte]: timestampDesde } },
    }),
    // Comprobantes no tiene timestamps, usamos la fecha de emisión
    Comprobante.sum("total", {
      where: {
        fecha_emision: { [Op.gte]: fechaDesde },
        tipo_comprobante_id: { [Op.in]: ["01", "03"] },
        estado_sunat: { [Op.ne]: "AN" },
      },
    }),
    // Almanaques también tienen timestamps
    require("../../models/almanaque/almanaque").sum("precioTotal", {
      where: { createdAt: { [Op.gte]: timestampDesde } },
    }),
  ]);

  const tickets = parseFloat(ventasTickets || 0);
  const comprobantes = parseFloat(ventasComprobantes || 0);
  const almanaques = parseFloat(ventasAlmanaques || 0);

  return {
    ventas_tickets: tickets + almanaques, // Agrupamos almanaques con tickets o podemos separarlos
    ventas_comprobantes: comprobantes,
    total: tickets + comprobantes + almanaques,
  };
}

/**
 * Registra la apertura de una nueva caja.
 * Verifica que no haya una caja ya abierta.
 * 
 * @param {import('express').Request} req - Body: { monto_apertura, observacion }
 * @param {import('express').Response} res - JSON con la nueva caja creada o error.
 */
const abrirCaja = async (req, res) => {
  try {
    const cajaAbierta = await AperturaCaja.findOne({ where: { estado: "abierta" } });
    if (cajaAbierta) {
      return res.status(400).json({ message: "Ya hay una caja abierta. Ciérrela antes de abrir una nueva." });
    }

    const { monto_apertura, observacion } = req.body;
    if (!monto_apertura || isNaN(parseFloat(monto_apertura))) {
      return res.status(400).json({ message: "El monto de apertura es requerido" });
    }

    const ahora = new Date();
    const hora = ahora.toTimeString().split(" ")[0]; // "HH:MM:SS"
    const fecha = ahora.toISOString().split("T")[0];  // "YYYY-MM-DD"

    const caja = await AperturaCaja.create({
      fecha_apertura: fecha,
      hora_apertura: hora,
      monto_apertura: parseFloat(monto_apertura),
      estado: "abierta",
      observacion: observacion || null,
    });

    res.json(caja);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Obtiene el estado actual de la caja abierta y un resumen de ventas acumulado.
 * 
 * @param {import('express').Request} _req 
 * @param {import('express').Response} res - JSON con datos de la caja y totales actuales.
 */
const getCajaActual = async (_req, res) => {
  try {
    const caja = await AperturaCaja.findOne({ where: { estado: "abierta" } });

    if (!caja) {
      return res.json({ caja: null, ventas_tickets: 0, ventas_comprobantes: 0, total_ventas_preview: 0 });
    }

    // Calcular ventas desde que se abrió la caja
    const ventas = await calcularVentas(caja);

    res.json({
      caja,
      ventas_tickets: ventas.ventas_tickets,
      ventas_comprobantes: ventas.ventas_comprobantes,
      total_ventas_preview: ventas.total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Realiza el cierre de una caja, calculando la diferencia entre el efectivo físico y el esperado.
 * 
 * @param {import('express').Request} req - Params: { id }; Body: { monto_cierre_fisico, observacion }
 * @param {import('express').Response} res - JSON con el resumen de cierre y diferencia calculada.
 */
const cerrarCaja = async (req, res) => {
  try {
    const { id } = req.params;
    const { monto_cierre_fisico, observacion } = req.body;

    if (monto_cierre_fisico === undefined || isNaN(parseFloat(monto_cierre_fisico))) {
      return res.status(400).json({ message: "El monto de cierre es requerido" });
    }

    const caja = await AperturaCaja.findByPk(id);
    if (!caja) return res.status(404).json({ message: "Caja no encontrada" });
    if (caja.estado === "cerrada") return res.status(400).json({ message: "La caja ya está cerrada" });

    const ventas = await calcularVentas(caja);
    const montoCierre = parseFloat(monto_cierre_fisico);
    const montoApertura = parseFloat(caja.monto_apertura);
    const totalVentas = ventas.total;
    // diferencia = (efectivo contado) - (efectivo esperado)
    // positivo = sobrante; negativo = faltante
    const diferencia = montoCierre - (montoApertura + totalVentas);

    caja.estado = "cerrada";
    caja.monto_cierre_fisico = montoCierre;
    caja.total_ventas = totalVentas;
    caja.diferencia = parseFloat(diferencia.toFixed(2));
    if (observacion) caja.observacion = observacion;
    await caja.save();

    res.json({
      caja,
      ventas_tickets: ventas.ventas_tickets,
      ventas_comprobantes: ventas.ventas_comprobantes,
      total_ventas: totalVentas,
      diferencia: caja.diferencia,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Obtiene el historial de las últimas 30 aperturas/cierres de caja.
 * 
 * @param {import('express').Request} _req 
 * @param {import('express').Response} res - Array de registros de caja.
 */
const getHistorialCaja = async (_req, res) => {
  try {
    const historial = await AperturaCaja.findAll({
      order: [["fecha_apertura", "DESC"], ["createdAt", "DESC"]],
      limit: 30,
    });
    res.json(historial);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── GET /ventas/dia ──────────────────────────────────────────────────────────

const getVentasDia = async (req, res) => {
  try {
    const fecha = req.query.fecha || new Date().toISOString().split("T")[0];
    const tipo = req.query.tipo || "all"; // all | ticket | boleta | factura

    const inicioFecha = new Date(`${fecha}T00:00:00`);
    const finFecha = new Date(`${fecha}T23:59:59`);

    const resultado = [];

    // Tickets
    if (tipo === "all" || tipo === "ticket") {
      const tickets = await Ticket.findAll({
        where: { fechaEmision: { [Op.between]: [inicioFecha, finFecha] } },
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
          fecha_emision: { [Op.between]: [inicioFecha, finFecha] },
          tipo_comprobante_id: { [Op.in]: tipoFilter },
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
    res.status(500).json({ message: error.message });
  }
};

module.exports = { abrirCaja, getCajaActual, cerrarCaja, getHistorialCaja, getVentasDia };
