const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize('postgres://postgres:123456@localhost:5432/servicios', { logging: false });

const GuiaRemision = sequelize.define('GuiaRemision', {
  id: { type: DataTypes.INTEGER, primaryKey: true },
  mensaje_sunat: DataTypes.STRING,
  codigo_sunat: DataTypes.STRING,
  estado_sunat: DataTypes.STRING,
  nombre_xml: DataTypes.STRING,
}, { tableName: 'GuiaRemision', timestamps: false });

GuiaRemision.findOne({ order: [['id', 'DESC']] }).then(g => {
  console.log(g?.toJSON());
  process.exit(0);
}).catch(console.error);
