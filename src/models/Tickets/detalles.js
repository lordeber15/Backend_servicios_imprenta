const { DataTypes } = require("sequelize");
const sequelize = require("../../database/database");
const Ticket = require("./tickets");

const DetalleTicket = sequelize.define("DetalleTicket", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  descripcion: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  precioUnitario: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  subtotal: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
});

// 🔗 Relaciones
Ticket.hasMany(DetalleTicket, { foreignKey: "ticketId", as: "detalles" });
DetalleTicket.belongsTo(Ticket, { foreignKey: "ticketId", as: "ticket" });

module.exports = DetalleTicket;
