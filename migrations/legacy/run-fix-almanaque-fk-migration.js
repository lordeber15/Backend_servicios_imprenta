'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Client } = require('pg');
const fs   = require('fs');
const path = require('path');

const client = new Client({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  user:     process.env.DB_USER     || 'servicios',
  password: process.env.DB_PASSWORD, // sin valor por defecto: debe venir del .env
  database: process.env.DB_NAME     || 'servicios',
});

async function run() {
  try {
    await client.connect();
    console.log('Conectado a PostgreSQL');

    const sql = fs.readFileSync(path.join(__dirname, 'fix_almanaque_detalle_fk.sql'), 'utf8');
    await client.query(sql);
    console.log('Migración aplicada correctamente');

    const { rows } = await client.query(`
      SELECT conname AS constraint_name, confrelid::regclass::text AS tabla_referenciada
      FROM pg_constraint
      WHERE conname = 'DetalleAlmanaques_AlmanaqueId_fkey'
    `);

    if (rows.length === 0 || rows[0].tabla_referenciada !== 'almanaque') {
      console.error('La FK no quedó apuntando a "almanaque" — revisar manualmente');
      console.table(rows);
      process.exitCode = 1;
    } else {
      console.log('FK verificada:');
      console.table(rows);
    }
  } catch (error) {
    console.error('Error ejecutando migración:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
    console.log('Conexión cerrada');
  }
}

run();
