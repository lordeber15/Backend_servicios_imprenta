'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Client } = require('pg');
const fs   = require('fs');
const path = require('path');

const client = new Client({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  user:     process.env.DB_USER     || 'servicios',
  password: process.env.DB_PASSWORD || 'admin123',
  database: process.env.DB_NAME     || 'servicios',
});

async function run() {
  try {
    await client.connect();
    console.log('Conectado a PostgreSQL');

    const sql = fs.readFileSync(path.join(__dirname, 'add_sunat_queue_fields.sql'), 'utf8');
    await client.query(sql);
    console.log('Migración aplicada correctamente');

    // Verificar resultado
    const { rows } = await client.query(`
      SELECT estado_sunat, COUNT(*) AS total
      FROM "Comprobante"
      GROUP BY estado_sunat
      ORDER BY total DESC
    `);

    if (rows.length === 0) {
      console.log('Tabla Comprobante vacía (sin registros previos)');
    } else {
      console.log('Distribución de estados tras la migración:');
      console.table(rows);
    }

    // Verificar columnas nuevas
    const { rows: cols } = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'Comprobante'
        AND column_name IN ('estado_sunat','cdr_xml','cdr_code','xml_path','hash','enviado_at')
      ORDER BY column_name
    `);
    console.log('Columnas verificadas:');
    console.table(cols);

  } catch (err) {
    console.error('Error en migración:', err.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Conexión cerrada');
  }
}

run();
