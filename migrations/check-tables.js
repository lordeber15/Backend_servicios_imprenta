const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'servicios',
  password: 'admin123',
  database: 'servicios'
});

async function checkTables() {
  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL\n');

    // Listar todas las tablas
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📋 Tablas en la base de datos:');
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.table_name}`);
    });

    // Buscar tablas que contengan "almanaque" en el nombre
    console.log('\n🔍 Buscando tablas relacionadas con "almanaque":');
    const almanaqueResults = result.rows.filter(row =>
      row.table_name.toLowerCase().includes('almanaque')
    );

    if (almanaqueResults.length === 0) {
      console.log('❌ No se encontraron tablas con "almanaque" en el nombre');
    } else {
      almanaqueResults.forEach(row => {
        console.log(`✅ Encontrada: ${row.table_name}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkTables();
