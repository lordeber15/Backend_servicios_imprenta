/**
 * GENERADOR DEL BASELINE DE MIGRACIONES
 *
 * Produce el esquema que el CÓDIGO espera (según los modelos Sequelize):
 *   1. Crea una base temporal vacía.
 *   2. sequelize.sync() crea ahí todas las tablas, índices y FKs.
 *   3. Guarda:
 *      - 0000-baseline.sql          → pg_dump --schema-only (lo ejecuta la migración 0000 en BDs nuevas)
 *      - 0000-baseline.schema.json  → tablas/columnas esperadas (lo usa `migrator diff/baseline`)
 *   4. Elimina la base temporal.
 *
 * Se ejecuta UNA vez (ya generado y versionado). Volver a correrlo solo si se
 * quiere regenerar el punto de partida, nunca después de aplicar migraciones nuevas.
 *
 * Uso (desde Desarrollo/):
 *   docker compose run --rm --no-deps \
 *     -v ./Backend_servicios_imprenta/src/infrastructure/database/migrations:/app/src/infrastructure/database/migrations \
 *     backend node scripts/generar-baseline.js
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { Sequelize } = require("sequelize");

const TMP_DB = "imprenta_baseline_tmp";
const DIR_SALIDA = path.join(__dirname, "../src/infrastructure/database/migrations");

const conn = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_MIGRATOR_USER || process.env.DB_USER,
  password: process.env.DB_MIGRATOR_PASSWORD || process.env.DB_PASSWORD,
};

async function main() {
  const admin = new Sequelize("postgres", conn.user, conn.password, {
    host: conn.host, port: conn.port, dialect: "postgres", logging: false,
  });
  await admin.query(`DROP DATABASE IF EXISTS "${TMP_DB}"`);
  await admin.query(`CREATE DATABASE "${TMP_DB}"`);
  console.log(`Base temporal ${TMP_DB} creada`);

  try {
    // database.js lee DB_NAME al cargarse: se apunta a la base temporal antes de requerirlo.
    process.env.DB_NAME = TMP_DB;
    const sequelize = require("../src/infrastructure/database/database");
    require("../src/infrastructure/database/cargarModelos")();
    await sequelize.sync();
    console.log(`Modelos sincronizados: ${Object.keys(sequelize.models).length}`);

    const { leerEsquema } = require("../src/infrastructure/database/schemaInfo");
    const esquema = await leerEsquema(sequelize);
    await sequelize.close();

    fs.writeFileSync(
      path.join(DIR_SALIDA, "0000-baseline.schema.json"),
      JSON.stringify(esquema, null, 2) + "\n"
    );

    const dump = execFileSync(
      "pg_dump",
      ["-h", conn.host, "-p", String(conn.port), "-U", conn.user, "-d", TMP_DB,
       "--schema-only", "--no-owner", "--no-acl", "--no-comments"],
      { env: { ...process.env, PGPASSWORD: conn.password }, maxBuffer: 64 * 1024 * 1024 }
    ).toString();

    // Se quitan del dump:
    // - meta-comandos de psql (\restrict, \unrestrict…): no son SQL.
    // - set_config('search_path', '') de sesión: dejaría la conexión sin
    //   search_path y romperían las migraciones siguientes del mismo proceso.
    const sql = dump
      .split("\n")
      .filter((l) => !l.startsWith("\\"))
      .filter((l) => !l.includes("set_config('search_path'"))
      .join("\n");

    fs.writeFileSync(path.join(DIR_SALIDA, "0000-baseline.sql"),
      "-- Generado por scripts/generar-baseline.js a partir de los modelos Sequelize.\n" +
      "-- NO editar a mano: los cambios de esquema van en migraciones nuevas.\n" + sql);

    console.log(`Baseline: ${Object.keys(esquema).length} tablas → ${DIR_SALIDA}`);
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS "${TMP_DB}" WITH (FORCE)`);
    await admin.close();
    console.log(`Base temporal ${TMP_DB} eliminada`);
  }
}

main().catch((err) => {
  console.error("Error generando baseline:", err);
  process.exit(1);
});
