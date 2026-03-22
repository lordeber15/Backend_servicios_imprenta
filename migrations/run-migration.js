const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuración de conexión desde .env
const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'servicios',
  password: 'admin123',
  database: 'servicios'
});

async function runMigration() {
  try {
    console.log('🔄 Conectando a PostgreSQL...');
    await client.connect();
    console.log('✅ Conexión exitosa');

    // Leer el archivo SQL
    const sqlFile = path.join(__dirname, 'add_tipo_to_almanaque.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('🔄 Ejecutando migración...');

    // Ejecutar la migración
    await client.query(sql);

    console.log('✅ Migración ejecutada exitosamente');

    // Verificar el resultado
    console.log('\n📊 Verificando resultado:');
    const result = await client.query('SELECT tipo, COUNT(*) as total FROM almanaques GROUP BY tipo');

    if (result.rows.length === 0) {
      console.log('ℹ️  No hay registros en la tabla almanaque');
    } else {
      console.table(result.rows);
    }

  } catch (error) {
    console.error('❌ Error ejecutando migración:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Conexión cerrada');
  }
}

runMigration();
