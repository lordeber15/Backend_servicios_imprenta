/**
 * 0000 — BASELINE: esquema completo de partida.
 *
 * - BD nueva (vacía): crea todo el esquema desde 0000-baseline.sql.
 * - BD existente (producción, desarrollo): NO se ejecuta. Se marca como
 *   aplicada con `npm run migrate:baseline`, que antes verifica que el
 *   esquema real sea compatible con 0000-baseline.schema.json.
 */
const fs = require("fs");
const path = require("path");

async function up({ context: { sequelize } }) {
  const [[{ n }]] = await sequelize.query(`
    SELECT count(*)::int AS n FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'SequelizeMeta'
  `);
  if (n > 0) {
    throw new Error(
      `La base ya tiene ${n} tablas: no se aplica el baseline sobre una BD existente. ` +
      "Compruebe la compatibilidad con `npm run migrate:diff` y márquela con `npm run migrate:baseline`."
    );
  }

  const sql = fs.readFileSync(path.join(__dirname, "0000-baseline.sql"), "utf8");
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(sql, { transaction });
  });
}

async function down() {
  throw new Error("El baseline no es reversible: para volver atrás restaure un backup.");
}

module.exports = { up, down };
