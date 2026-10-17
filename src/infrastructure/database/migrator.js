/**
 * MIGRADOR DE ESQUEMA (Umzug + SequelizeStorage)
 *
 * Reemplaza a sequelize.sync(): el esquema solo cambia mediante migraciones
 * versionadas en ./migrations, registradas en la tabla "SequelizeMeta".
 *
 * Comandos (node src/infrastructure/database/migrator.js <comando>):
 *   up        Aplica las migraciones pendientes (con backup previo si la BD tiene datos)
 *   down      Revierte la última migración
 *   status    Lista aplicadas y pendientes
 *   diff      Compara el esquema real con el baseline (no modifica nada)
 *   baseline  Marca 0000-baseline como aplicada en una BD existente,
 *             solo si su esquema es compatible
 *
 * Credenciales: usa DB_MIGRATOR_USER / DB_MIGRATOR_PASSWORD si existen (rol con
 * permisos DDL), si no DB_USER / DB_PASSWORD. Así la app puede correr con un
 * rol sin permisos para alterar el esquema.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { Sequelize } = require("sequelize");
const { Umzug, SequelizeStorage } = require("umzug");
const { leerEsquema, compararEsquemas } = require("./schemaInfo");

const DIR_MIGRACIONES = path.join(__dirname, "migrations");
const ESQUEMA_BASELINE = path.join(DIR_MIGRACIONES, "0000-baseline.schema.json");
const BASELINE = "0000-baseline.js";
const DIR_BACKUPS = path.join(process.cwd(), "storage", "backups-migracion");
const BACKUPS_A_CONSERVAR = 10;

/** Nombres de los archivos de migración, en orden. */
const archivosMigracion = () =>
  fs.readdirSync(DIR_MIGRACIONES).filter((f) => /^\d{4}-.+\.js$/.test(f)).sort();

function conexion() {
  const user = process.env.DB_MIGRATOR_USER || process.env.DB_USER;
  const password = process.env.DB_MIGRATOR_PASSWORD || process.env.DB_PASSWORD;
  const opts = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    dialect: "postgres",
    logging: false,
  };
  return { sequelize: new Sequelize(process.env.DB_NAME, user, password, opts), user, password, ...opts };
}

function crearUmzug(sequelize) {
  return new Umzug({
    migrations: {
      glob: path.join(DIR_MIGRACIONES, "[0-9][0-9][0-9][0-9]-*.js"),
    },
    context: { sequelize, queryInterface: sequelize.getQueryInterface(), Sequelize },
    storage: new SequelizeStorage({ sequelize }),
    logger: { info: (e) => e.event && console.log(`  ${e.event}: ${e.name}`), warn: console.warn, error: console.error, debug: () => {} },
  });
}

async function tablasDeNegocio(sequelize) {
  const [[{ n }]] = await sequelize.query(`
    SELECT count(*)::int AS n FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'SequelizeMeta'`);
  return n;
}

/** pg_dump completo antes de migrar; conserva los últimos BACKUPS_A_CONSERVAR. */
function backupPrevio(c) {
  fs.mkdirSync(DIR_BACKUPS, { recursive: true, mode: 0o700 });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const archivo = path.join(DIR_BACKUPS, `${process.env.DB_NAME}-${ts}.dump`);
  execFileSync(
    "pg_dump",
    ["-h", c.host, "-p", String(c.port), "-U", c.user, "-d", process.env.DB_NAME, "-Fc", "--no-owner", "--no-acl", "-f", archivo],
    { env: { ...process.env, PGPASSWORD: c.password }, stdio: ["ignore", "ignore", "inherit"] }
  );
  fs.chmodSync(archivo, 0o600);
  console.log(`Backup previo: ${archivo}`);

  const viejos = fs.readdirSync(DIR_BACKUPS).filter((f) => f.endsWith(".dump")).sort().slice(0, -BACKUPS_A_CONSERVAR);
  for (const f of viejos) fs.unlinkSync(path.join(DIR_BACKUPS, f));
}

function imprimirDiff(d) {
  const bloque = (titulo, items) => items.length && console.log(`\n${titulo} (${items.length}):\n  - ${items.join("\n  - ")}`);
  bloque("✗ Tablas que faltan en la BD", d.tablasFaltantes);
  bloque("✗ Columnas que faltan en la BD", d.columnasFaltantes);
  bloque("✗ Columnas con otro tipo", d.tipos);
  bloque("ⓘ Sobrantes en la BD (no bloquean)", d.sobrantes);
  console.log(d.compatible ? "\n✓ Esquema compatible con el baseline" : "\n✗ Esquema NO compatible con el baseline");
}

const comandos = {
  async up(c, umzug) {
    const pendientes = await umzug.pending();
    if (!pendientes.length) return console.log("Sin migraciones pendientes");

    const ejecutadas = await umzug.executed();
    if (!ejecutadas.length && (await tablasDeNegocio(c.sequelize)) > 0) {
      throw new Error(
        "La BD tiene tablas pero ninguna migración registrada. " +
        "Revise `npm run migrate:diff` y márquela con `npm run migrate:baseline` antes de migrar."
      );
    }
    if ((await tablasDeNegocio(c.sequelize)) > 0) backupPrevio(c);

    console.log(`Aplicando ${pendientes.length} migración(es):`);
    await umzug.up();
    console.log("Migraciones aplicadas");
  },

  async down(_c, umzug) {
    const [ultima] = (await umzug.executed()).slice(-1);
    if (!ultima) return console.log("No hay migraciones aplicadas");
    await umzug.down();
    console.log(`Revertida: ${ultima.name}`);
  },

  async status(_c, umzug) {
    const ejecutadas = await umzug.executed();
    const pendientes = await umzug.pending();
    console.log(`Aplicadas (${ejecutadas.length}):`);
    ejecutadas.forEach((m) => console.log(`  ✓ ${m.name}`));
    console.log(`Pendientes (${pendientes.length}):`);
    pendientes.forEach((m) => console.log(`  · ${m.name}`));
  },

  async diff(c) {
    const d = compararEsquemas(await leerEsquema(c.sequelize), JSON.parse(fs.readFileSync(ESQUEMA_BASELINE, "utf8")));
    imprimirDiff(d);
    if (!d.compatible) process.exitCode = 1;
  },

  async baseline(c, umzug) {
    if ((await umzug.executed()).some((m) => m.name === BASELINE)) {
      return console.log("El baseline ya está registrado");
    }
    if ((await tablasDeNegocio(c.sequelize)) === 0) {
      return console.log("BD vacía: no hace falta marcar el baseline, ejecute `migrate` para crear el esquema");
    }
    const d = compararEsquemas(await leerEsquema(c.sequelize), JSON.parse(fs.readFileSync(ESQUEMA_BASELINE, "utf8")));
    imprimirDiff(d);
    if (!d.compatible) {
      throw new Error("No se marca el baseline: el esquema real no coincide con lo que el código espera. Corrija las diferencias primero.");
    }
    await new SequelizeStorage({ sequelize: c.sequelize }).logMigration({ name: BASELINE });
    console.log(`\nBaseline marcado como aplicado (${BASELINE})`);
  },
};

/**
 * Para main.js / worker.js: falla si hay migraciones sin aplicar.
 * Solo lee SequelizeMeta, nunca la crea ni modifica (la app puede no tener permisos DDL).
 */
async function verificarMigraciones(sequelize) {
  const [[{ existe }]] = await sequelize.query(`SELECT to_regclass('public."SequelizeMeta"') IS NOT NULL AS existe`);
  const aplicadas = existe
    ? new Set((await sequelize.query(`SELECT name FROM "SequelizeMeta"`))[0].map((r) => r.name))
    : new Set();
  const pendientes = archivosMigracion().filter((f) => !aplicadas.has(f));
  if (pendientes.length) {
    throw new Error(
      `Hay ${pendientes.length} migración(es) sin aplicar: ${pendientes.join(", ")}. ` +
      "Ejecute el servicio `migrate` (docker compose run --rm migrate) antes de arrancar."
    );
  }
}

module.exports = { verificarMigraciones };

if (require.main === module) {
  const nombre = process.argv[2];
  if (!comandos[nombre]) {
    console.error(`Uso: migrator.js <${Object.keys(comandos).join("|")}>`);
    process.exit(2);
  }
  const c = conexion();
  comandos[nombre](c, crearUmzug(c.sequelize))
    .catch((err) => {
      console.error(`\n✗ ${err.message}`);
      process.exitCode = 1;
    })
    .finally(() => c.sequelize.close());
}
