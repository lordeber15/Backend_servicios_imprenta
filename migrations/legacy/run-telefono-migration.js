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

    const sql = fs.readFileSync(path.join(__dirname, 'add_telefono_to_almanaque.sql'), 'utf8');
    await client.query(sql);
    console.log('Migración aplicada correctamente');

    const { rows } = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name IN ('almanaques', 'almanaque') AND column_name = 'telefono'
    `);

    if (rows.length === 0) {
      console.error('La columna telefono no aparece en information_schema — revisar la migración');
      process.exitCode = 1;
    } else {
      console.log('Columna telefono verificada:');
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
