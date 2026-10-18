const Ticket = require("../../../database/models/Tickets/tickets");
const Detalle = require("../../../database/models/Tickets/detalles");
const Producto = require("../../../database/models/facturacion/producto");
const Unidad = require("../../../database/models/facturacion/unidad");
const Emisor = require("../../../database/models/facturacion/emisor");
const { Servicios } = require("../../../database/models/servicios");
const { generarTicketPdf } = require("../../../external_services/tickets/ticketPdfGenerator");
const sequelize = require("../../../database/database");
const { exigirCajaAbierta, exigirCajaNoCerrada } = require("../../../../application/services/caja.service");
const { METODOS_PAGO } = require("../../../../application/constantes");
const { hoyLocal } = require("../../../utils/fecha");
const { ValidationError, NotFoundError } = require("../../../utils/errors");

// Obtener todos los tickets con sus detalles
const getTickets = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);

    if (page && limit) {
      const offset = (page - 1) * limit;
      const { count, rows } = await Ticket.findAndCountAll({
        include: [{ model: Detalle, as: "detalles" }],
        order: [["id", "DESC"]],
        limit,
        offset,
        distinct: true,
      });
      return res.json({ data: rows, total: count, page, limit });
    }

    const tickets = await Ticket.findAll({
      include: [{ model: Detalle, as: "detalles" }],
      order: [["id", "DESC"]],
    });
    res.json(tickets);
  } catch (error) {
    next(error);
  }
};

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/**
 * Normaliza los detalles y calcula los montos en el servidor (no se confía
 * en los totales del cliente):
 *   subtotal      = cantidad × precioUnitario
 *   precioTotal   = Σ subtotal
 *   monto_cobrado = lo que entra a caja ahora: en servicios el adelanto
 *                   (0 ≤ adelanto ≤ subtotal), en productos el subtotal.
 */
function calcularTicket(detalles) {
  if (!Array.isArray(detalles) || !detalles.length) {
    throw new ValidationError("El ticket debe tener al menos un ítem");
  }
  const lineas = detalles.map((d) => {
    const cantidad = Number(d.cantidad);
    const precioUnitario = Number(d.precioUnitario);
    if (!(cantidad > 0) || !(precioUnitario >= 0)) {
      throw new ValidationError("Cantidad y precio de cada ítem deben ser válidos");
    }
    const subtotal = r2(cantidad * precioUnitario);
    const esServicio = Boolean(d.es_servicio);
    const adelanto = esServicio ? Math.min(Math.max(r2(d.adelanto), 0), subtotal) : 0;
    return {
      descripcion: String(d.descripcion || "").slice(0, 255),
      cantidad,
      precioUnitario,
      subtotal,
      producto_id: d.producto_id || null,
      es_servicio: esServicio,
      adelanto,
    };
  });
  return {
    lineas,
    precioTotal: r2(lineas.reduce((s, l) => s + l.subtotal, 0)),
    monto_cobrado: r2(lineas.reduce((s, l) => s + (l.es_servicio ? l.adelanto : l.subtotal), 0)),
  };
}

// Crear ticket con detalles (requiere caja abierta)
const createTicket = async (req, res, next) => {
  try {
    const { cliente, tipoDocumento, numeroDocumento, direccion, fechaEmision,
            metodo_pago, monto_recibido, vuelto, detalles } = req.body || {};

    const metodo = metodo_pago || "Efectivo";
    if (!METODOS_PAGO.includes(metodo)) throw new ValidationError(`Método de pago no válido: ${metodo}`);
    const { lineas, precioTotal, monto_cobrado } = calcularTicket(detalles);

    const ticket = await sequelize.transaction(async (transaction) => {
      const caja = await exigirCajaAbierta(transaction);

      const t = await Ticket.create({
        cliente: cliente || "Sin nombre",
        tipoDocumento: tipoDocumento || "Sin Documento",
        numeroDocumento: numeroDocumento || "00000000",
        direccion,
        fechaEmision: fechaEmision || hoyLocal(),
        precioTotal,
        monto_cobrado,
        metodo_pago: metodo,
        monto_recibido: monto_recibido ?? null,
        vuelto: vuelto ?? null,
        caja_id: caja.id,
        detalles: lineas, // Sequelize lo inserta en DetalleTicket
      }, { include: [{ model: Detalle, as: "detalles" }], transaction });

      // Stock de productos (no servicios)
      for (const d of lineas.filter((x) => x.producto_id)) {
        await Producto.decrement("stock", {
          by: d.cantidad,
          where: { id: d.producto_id, es_servicio: false },
          transaction,
        });
      }

      // Trabajo en el Dashboard por cada servicio
      for (const d of lineas.filter((x) => x.es_servicio)) {
        await Servicios.create({
          nombre: t.cliente,
          cantidad: d.cantidad,
          descripcion: d.descripcion,
          estado: "Pendiente",
          total: d.subtotal,
          acuenta: d.adelanto,
        }, { transaction });
      }
      return t;
    });

    res.json(ticket);
  } catch (error) {
    next(error);
  }
};

// Actualizar ticket con detalles (solo Administrador, solo si su caja sigue abierta)
const updateTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cliente, tipoDocumento, numeroDocumento, direccion, fechaEmision,
            monto_recibido, vuelto, detalles } = req.body || {};

    const actualizado = await sequelize.transaction(async (transaction) => {
      const ticket = await Ticket.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!ticket) throw new NotFoundError("Ticket no encontrado");
      await exigirCajaNoCerrada(ticket.caja_id, transaction);

      const cambios = { cliente, tipoDocumento, numeroDocumento, direccion, fechaEmision };
      if (monto_recibido !== undefined) cambios.monto_recibido = monto_recibido;
      if (vuelto !== undefined) cambios.vuelto = vuelto;

      if (detalles !== undefined) {
        const { lineas, precioTotal, monto_cobrado } = calcularTicket(detalles);
        Object.assign(cambios, { precioTotal, monto_cobrado });
        await Detalle.destroy({ where: { ticketId: ticket.id }, transaction });
        await Detalle.bulkCreate(lineas.map((d) => ({ ...d, ticketId: ticket.id })), { transaction });
      }
      await ticket.update(cambios, { transaction });
      return Ticket.findByPk(ticket.id, { include: ["detalles"], transaction });
    });
    res.json(actualizado);
  } catch (error) {
    return next(error);
  }
};

// Eliminar ticket (solo Administrador, solo si su caja sigue abierta)
const deleteTicket = async (req, res, next) => {
  try {
    await sequelize.transaction(async (transaction) => {
      const ticket = await Ticket.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!ticket) throw new NotFoundError("Ticket no encontrado");
      await exigirCajaNoCerrada(ticket.caja_id, transaction);
      await ticket.destroy({ transaction });
    });
    res.json({ message: "Ticket eliminado correctamente" });
  } catch (error) {
    return next(error);
  }
};

// Generar PDF del ticket
const getTicketPdf = async (req, res, next) => {
  try {
    const { id } = req.params;
    const format = req.query.format || "80mm";

    const ticket = await Ticket.findByPk(id, {
      include: [{ model: Detalle, as: "detalles" }],
    });
    if (!ticket) return res.status(404).json({ message: "Ticket no encontrado" });

    // Enriquecer detalles con nombre de unidad
    const productoIds = ticket.detalles.filter((d) => d.producto_id).map((d) => d.producto_id);
    const productos = productoIds.length > 0
      ? await Producto.findAll({ where: { id: productoIds }, attributes: ["id", "unidad_id"] })
      : [];
    const unidadIds = [...new Set(productos.map((p) => p.unidad_id).filter(Boolean))];
    const unidades = unidadIds.length > 0
      ? await Unidad.findAll({ where: { id: unidadIds } })
      : [];

    const prodMap = Object.fromEntries(productos.map((p) => [p.id, p.unidad_id]));
    const uniMap = Object.fromEntries(unidades.map((u) => [u.id, u.descripcion || u.id]));

    const detallesEnriquecidos = ticket.detalles.map((d) => {
      const unidadId = prodMap[d.producto_id];
      return { ...d.toJSON(), _unidad: uniMap[unidadId] || "" };
    });

    const emisor = await Emisor.findOne();
    const pdfBuffer = await generarTicketPdf(ticket, detallesEnriquecidos, format, emisor);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="ticket-${String(id).padStart(6, "0")}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTickets,
  createTicket,
  updateTicket,
  deleteTicket,
  getTicketPdf,
};
