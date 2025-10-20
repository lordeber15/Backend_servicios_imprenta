const Ticket = require("../../models/Tickets/tickets");
const Detalle = require("../../models/Tickets/detalles");

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

module.exports = {
  getTickets,
  createTicket,
  updateTicket,
  deleteTicket,
};
