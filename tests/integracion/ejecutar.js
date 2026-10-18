// Ejecutor de las pruebas de integración. Corre DENTRO del servicio
// "pruebas" de docker-compose.test.yml (red sin salida a Internet, Postgres y
// Redis desechables, certificado autofirmado). Por cada *.prueba.js:
//   BD nueva → migraciones desde cero → prueba → BD eliminada, Redis vacío.
// Uso: node tests/integracion/ejecutar.js [nombre ...]   (sin nombres: todas)
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { Client } = require("pg");
const Redis = require("ioredis");
const crypto = require("crypto");
const { generarCertificadoPrueba } = require("./certificadoPrueba");

// Secretos de prueba aleatorios en cada corrida: no viven en ningún archivo.
process.env.JWT_SECRET ||= crypto.randomBytes(48).toString("hex");
process.env.DATA_ENCRYPTION_KEY ||= crypto.randomBytes(32).toString("base64");

const DIR = __dirname;
const RAIZ = path.join(DIR, "../..");
const pedidas = process.argv.slice(2).map((n) => n.replace(/(\.prueba)?\.js$/, ""));
const pruebas = fs.readdirSync(DIR).filter((f) => f.endsWith(".prueba.js"))
  .filter((f) => !pedidas.length || pedidas.includes(f.replace(".prueba.js", ""))).sort();

async function admin(sql) {
  const c = new Client({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: "postgres" });
  await c.connect();
  try { await c.query(sql); } finally { await c.end(); }
}

(async () => {
  if (!pruebas.length) { console.error("No hay pruebas que coincidan:", pedidas.join(", ")); process.exit(1); }
  const certPath = "/tmp/certificado-prueba.pfx";
  const certPassword = generarCertificadoPrueba(certPath);
  for (const d of ["storage/xml", "storage/cdr"]) fs.mkdirSync(path.join(RAIZ, d), { recursive: true });
  const redis = new Redis({ host: process.env.REDIS_HOST, maxRetriesPerRequest: 2 });

  const resultados = [];
  for (const archivo of pruebas) {
    const nombre = archivo.replace(".prueba.js", "");
    const db = `prueba_${nombre}`;
    console.log(`\n══ ${nombre} ${"═".repeat(Math.max(0, 60 - nombre.length))}`);
    await admin(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`);
    await admin(`CREATE DATABASE ${db}`);
    await redis.flushall();
    const env = { ...process.env, DB_NAME: db, SUNAT_CERT_PATH: certPath, SUNAT_CERT_PASSWORD: certPassword };

    const mig = spawnSync("node", ["src/infrastructure/database/migrator.js", "up"], { cwd: RAIZ, env, encoding: "utf8" });
    if (mig.status !== 0) {
      console.error(mig.stdout, mig.stderr);
      resultados.push({ nombre, ok: false, motivo: "migraciones" });
      continue;
    }
    const inicio = Date.now();
    const r = spawnSync("node", [path.join(DIR, archivo)], { cwd: RAIZ, env, stdio: "inherit", timeout: 10 * 60_000 });
    resultados.push({ nombre, ok: r.status === 0, seg: Math.round((Date.now() - inicio) / 1000) });
    await admin(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`);
  }
  await redis.quit();

  console.log("\n══ Resumen de integración ══");
  for (const r of resultados) console.log(`  ${r.ok ? "✓" : "✗"} ${r.nombre}${r.seg !== undefined ? ` (${r.seg}s)` : ""}${r.motivo ? ` — falló: ${r.motivo}` : ""}`);
  process.exit(resultados.every((r) => r.ok) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
