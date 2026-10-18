/**
 * 0005 — Bitácora de auditoría.
 *
 * Registra quién hizo qué sobre las operaciones sensibles (login, emisión,
 * bajas, caja, emisor/series, usuarios). Es de solo-anexar: al rol de la
 * aplicación (DB_USER) se le quitan UPDATE/DELETE/TRUNCATE sobre la tabla,
 * así que ni una cuenta comprometida ni una inyección SQL pueden borrar el
 * rastro. Si la app corre con el mismo rol dueño (sin roles-bd.sql) no se
 * puede revocar nada y solo se avisa.
 */
async function up({ context: { sequelize } }) {
  await sequelize.transaction(async (transaction) => {
    const q = (sql, opts = {}) => sequelize.query(sql, { transaction, ...opts });

    await q(`CREATE TABLE IF NOT EXISTS "AuditLog" (
      id          BIGSERIAL PRIMARY KEY,
      usuario_id  INTEGER REFERENCES logins(id) ON UPDATE CASCADE ON DELETE SET NULL,
      usuario     VARCHAR(255),
      accion      VARCHAR(60) NOT NULL,
      entidad     VARCHAR(60),
      entidad_id  VARCHAR(60),
      antes       JSONB,
      despues     JSONB,
      ip          VARCHAR(64),
      user_agent  VARCHAR(255),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await q(`CREATE INDEX IF NOT EXISTS "AuditLog_created_at" ON "AuditLog" (created_at)`);
    await q(`CREATE INDEX IF NOT EXISTS "AuditLog_entidad" ON "AuditLog" (entidad, entidad_id)`);
    await q(`CREATE INDEX IF NOT EXISTS "AuditLog_usuario_id" ON "AuditLog" (usuario_id)`);

    const appUser = process.env.DB_USER;
    const [[{ actual }]] = await q(`SELECT current_user AS actual`);
    const [existe] = await q(`SELECT 1 FROM pg_roles WHERE rolname = :r`, { replacements: { r: appUser || "" } });
    if (appUser && appUser !== actual && existe.length) {
      await q(`REVOKE UPDATE, DELETE, TRUNCATE ON "AuditLog" FROM "${appUser.replace(/"/g, '""')}"`);
    } else {
      console.warn("[0005] La app usa el rol dueño: AuditLog no queda protegida contra borrado (ver scripts/roles-bd.sql)");
    }
  });
}

async function down({ context: { sequelize } }) {
  await sequelize.query(`DROP TABLE IF EXISTS "AuditLog"`);
}

module.exports = { up, down };
