const Ticket = require("../../../database/models/Tickets/tickets");
const Detalle = require("../../../database/models/Tickets/detalles");
const Producto = require("../../../database/models/facturacion/producto");
const Unidad = require("../../../database/models/facturacion/unidad");
const Emisor = require("../../../database/models/facturacion/emisor");
const { generarTicketPdf } = require("../../../external_services/tickets/ticketPdfGenerator");

// Obtener todos los tickets con sus detalles
const getTickets = async (req, res) => {
  try {
    const tickets = await Ticket.findAll({
      include: [{ model: Detalle, as: "detalles" }],
    });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Crear ticket con detalles
const createTicket = async (req, res) => {
  try {
    const {
      cliente,
      tipoDocumento,
      numeroDocumento,
      direccion,
      fechaEmision,
      precioTotal,
      detalles,
    } = req.body;

    const ticket = await Ticket.create(
      {
        cliente,
        tipoDocumento,
        numeroDocumento,
        direccion,
        fechaEmision,
        precioTotal,
        detalles, // 👈 Sequelize lo insertará en DetalleTicket automáticamente
      },
      {
        include: [{ model: Detalle, as: "detalles" }],
      }
    );

    // Decrementar stock para ítems vinculados a productos (no servicios)
    const conProducto = (ticket.detalles || []).filter((d) => d.producto_id);
    for (const d of conProducto) {
      await Producto.decrement("stock", {
        by: d.cantidad,
        where: { id: d.producto_id, es_servicio: false },
      });
    }

    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Actualizar ticket con detalles
const updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      cliente,
      tipoDocumento,
      numeroDocumento,
      direccion,
      fechaEmision,
      precioTotal,
      detalles,
    } = req.body;

    const ticket = await Ticket.findByPk(id, { include: ["detalles"] });
    if (!ticket)
      return res.status(404).json({ message: "Ticket no encontrado" });

    // Actualizar los campos principales
    ticket.cliente = cliente;
    ticket.tipoDocumento = tipoDocumento;
    ticket.numeroDocumento = numeroDocumento;
    ticket.direccion = direccion;
    ticket.fechaEmision = fechaEmision;
    ticket.precioTotal = precioTotal;
    await ticket.save();

    // Reemplazar los detalles
    await Detalle.destroy({ where: { ticketId: ticket.id } });
    if (detalles && detalles.length > 0) {
      await Detalle.bulkCreate(
        detalles.map((d) => ({ ...d, ticketId: ticket.id }))
      );
    }

    const ticketActualizado = await Ticket.findByPk(ticket.id, {
      include: ["detalles"],
    });
    res.json(ticketActualizado);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Eliminar ticket
const deleteTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await Ticket.findByPk(id);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket no encontrado" });
    }

    await ticket.destroy();
    res.json({ message: "Ticket eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Generar PDF del ticket
const getTicketPdf = async (req, res) => {
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
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getTickets,
  createTicket,
  updateTicket,
  deleteTicket,
  getTicketPdf,
};
