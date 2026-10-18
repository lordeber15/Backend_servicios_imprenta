/**
 * 0004 — Sesiones con refresh token rotativo.
 *
 * Antes el JWT duraba 8 h, vivía en localStorage (legible por cualquier XSS)
 * y no había forma de revocarlo: desactivar un usuario no le quitaba el acceso
 * hasta que el token expiraba.
 *
 * 1. Aborta si hay nombres de usuario duplicados (sin distinguir mayúsculas)
 *    y crea el índice único: el login busca por nombre y no puede ser ambiguo.
 * 2. logins.token_version: al cambiar contraseña, cargo o desactivar, se
 *    incrementa y todos los access tokens emitidos dejan de valer.
 * 3. Tabla RefreshTokens: solo guarda el SHA-256 del token (nunca el token).
 *    family_id agrupa las rotaciones de una misma sesión; si se reutiliza un
 *    token ya rotado (robo), se revoca toda la familia.
 */
async function up({ context: { sequelize } }) {
  await sequelize.transaction(async (transaction) => {
    const q = (sql, opts = {}) => sequelize.query(sql, { transaction, ...opts });

    // ── 1. Usuarios únicos ────────────────────────────────────────────────
    const [duplicados] = await q(`
      SELECT lower(usuario) AS u, string_agg(id::text, ', ' ORDER BY id) AS ids
      FROM logins GROUP BY lower(usuario) HAVING COUNT(*) > 1`);
    if (duplicados.length) {
      throw new Error(
        "Hay nombres de usuario duplicados; renómbrelos antes de migrar:\n  - " +
        duplicados.map((d) => `"${d.u}" (ids ${d.ids})`).join("\n  - ")
      );
    }
    await q(`CREATE UNIQUE INDEX IF NOT EXISTS logins_usuario_unico ON logins (lower(usuario))`);

    // ── 2. Versión de credenciales ────────────────────────────────────────
    await q(`ALTER TABLE logins ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0`);

    // ── 3. Refresh tokens ─────────────────────────────────────────────────
    await q(`CREATE TABLE IF NOT EXISTS "RefreshTokens" (
      id             BIGSERIAL PRIMARY KEY,
      usuario_id     INTEGER NOT NULL REFERENCES logins(id) ON UPDATE CASCADE ON DELETE CASCADE,
      token_hash     VARCHAR(64) NOT NULL,
      family_id      UUID NOT NULL,
      sesion_inicio  TIMESTAMPTZ NOT NULL,
      expires_at     TIMESTAMPTZ NOT NULL,
      revoked_at     TIMESTAMPTZ,
      revoked_motivo VARCHAR(30),
      user_agent     VARCHAR(255),
      ip             VARCHAR(64),
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await q(`CREATE UNIQUE INDEX IF NOT EXISTS "RefreshTokens_token_hash" ON "RefreshTokens" (token_hash)`);
    await q(`CREATE INDEX IF NOT EXISTS "RefreshTokens_family_id" ON "RefreshTokens" (family_id)`);
    await q(`CREATE INDEX IF NOT EXISTS "RefreshTokens_usuario_id" ON "RefreshTokens" (usuario_id)`);
  });
}

async function down({ context: { sequelize } }) {
  await sequelize.transaction(async (transaction) => {
    const q = (sql) => sequelize.query(sql, { transaction });
    await q(`DROP TABLE IF EXISTS "RefreshTokens"`);
    await q(`ALTER TABLE logins DROP COLUMN IF EXISTS token_version`);
    await q(`DROP INDEX IF EXISTS logins_usuario_unico`);
  });
}

module.exports = { up, down };
