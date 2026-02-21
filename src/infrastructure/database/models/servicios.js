/**
 * MODELO SERVICIOS
 * 
 * Representa la tabla 'servicios' en la base de datos PostgreSQL.
 * Almacena la información de las órdenes de trabajo/servicios de la imprenta.
 */
const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const Servicios = sequelize.define("servicios", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false, // Nombre del cliente o razón social
  },
  cantidad: {
    type: DataTypes.DECIMAL,
    allowNull: false, // Cantidad de unidades del trabajo
  },
  descripcion: {
    type: DataTypes.STRING,
    allowNull: false, // Detalle técnico del pedido
  },
  estado: {
    type: DataTypes.STRING,
    allowNull: false, // Estado actual (ej: 'Pendiente', 'Entregado')
  },
  total: {
    type: DataTypes.DECIMAL,
    allowNull: false, // Monto total pactado
  },
  acuenta: {
    type: DataTypes.DECIMAL,
    allowNull: false, // Monto adelantado por el cliente
  },
});

module.exports = { Servicios };
