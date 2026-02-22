const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize('postgres://postgres:123456@localhost:5432/servicios', { logging: false });
const DetalleGuia = sequelize.define('DetalleGuia', { guia_id: DataTypes.INTEGER }, { tableName: 'DetalleGuia', timestamps: false });
async function check() {
  const c = await DetalleGuia.count({ where: { guia_id: 3 } });
  console.log('Detalles Guia 3:', c);
  const total = await DetalleGuia.count();
  console.log('Total Detalles:', total);
  
  const g = await sequelize.query("SELECT * FROM \"DetalleGuia\" LIMIT 5");
  console.log(g[0]);
  process.exit(0);
}
check();
