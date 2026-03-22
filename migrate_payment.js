require('dotenv').config();
const sequelize = require('./src/infrastructure/database/database.js');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('DB connected');

    // Tickets
    try {
        await sequelize.query(`ALTER TABLE "Tickets" ADD COLUMN "metodo_pago" VARCHAR(50) DEFAULT 'Efectivo';`);
        console.log('Tickets altered');
    } catch (e) {
        console.log('Tickets might already have method_pago', e.message);
    }

    // Comprobante
    try {
        await sequelize.query(`ALTER TABLE "Comprobante" ADD COLUMN "metodo_pago" VARCHAR(50) DEFAULT 'Efectivo';`);
        console.log('Comprobante altered');
    } catch(e) {
        console.log('Comprobante might already have method_pago', e.message);
    }
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
migrate();
