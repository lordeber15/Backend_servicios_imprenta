const { DataTypes } = require("sequelize");
const sequelize = require("../../database");

const Almanaque = sequelize.define("almanaque", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  cliente: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  tipoDocumento: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  numeroDocumento: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  direccion: {
    type: DataTypes.STRING,
  },
  telefono: {
    type: DataTypes.STRING,
  },
  fechaEmision: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  aCuenta: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  precioTotal: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  caja_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: "AperturaCajas", key: "id" }, // caja abierta al registrar el movimiento
  },
  tipo: {
    // Usar STRING en lugar de ENUM para evitar que Sequelize cree su propio tipo
    // El constraint ENUM ya existe en la BD como tipo_almanaque
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'cotizacion',
    validate: {
      isIn: [['cotizacion', 'venta']]
    }
  },
  impreso: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  // Configuración adicional para evitar sincronización automática
  timestamps: true,
  freezeTableName: true
});

module.exports = Almanaque;
