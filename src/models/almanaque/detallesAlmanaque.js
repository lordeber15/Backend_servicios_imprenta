const { DataTypes } = require("sequelize");
const sequelize = require("../../database/database");
const Almanaque = require("./almanaque");

const DetalleAlmanaque = sequelize.define("DetalleAlmanaque", {
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
Almanaque.hasMany(DetalleAlmanaque, {
  foreignKey: "AlmanaqueId",
  as: "detalles",
});
DetalleAlmanaque.belongsTo(Almanaque, {
  foreignKey: "AlmanaqueId",
  as: "almanaque",
});

module.exports = DetalleAlmanaque;
