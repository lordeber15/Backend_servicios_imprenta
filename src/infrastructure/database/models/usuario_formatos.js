const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const { Login } = require("./login");
const { Formato } = require("./formatos");

const UsuarioFormato = sequelize.define("usuario_formato", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  usuario_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  formato_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
});

// Relaciones muchos-a-muchos
Login.belongsToMany(Formato, { through: UsuarioFormato, foreignKey: "usuario_id", as: "formatos" });
Formato.belongsToMany(Login, { through: UsuarioFormato, foreignKey: "formato_id", as: "usuarios" });

module.exports = { UsuarioFormato };
