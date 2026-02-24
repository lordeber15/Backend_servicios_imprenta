const { DataTypes } = require("sequelize");
const sequelize = require("../../database");
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
  producto_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  es_servicio: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  adelanto: {
    type: DataTypes.DECIMAL,
    defaultValue: 0,
  },
});

// 🔗 Relaciones
Ticket.hasMany(DetalleTicket, { foreignKey: "ticketId", as: "detalles" });
DetalleTicket.belongsTo(Ticket, { foreignKey: "ticketId", as: "ticket" });

module.exports = DetalleTicket;
