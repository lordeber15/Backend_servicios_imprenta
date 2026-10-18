/**
 * 0006 — Credenciales SUNAT del emisor, cifradas y fuera de la tabla Emisor.
 *
 * Antes clave_sol y client_secret vivían en texto plano en "Emisor", y
 * GET /emisor (y cualquier consulta que incluyera al emisor) se los devolvía
 * a todo usuario autenticado.
 *
 * 1. Tabla "EmisorCredenciales" (una fila por emisor) con los secretos
 *    cifrados con AES-256-GCM (utils/cifrado.js, llave DATA_ENCRYPTION_KEY).
 *    Ningún modelo la asocia: no puede colarse en un include.
 * 2. Copia cifrada de los valores existentes.
 * 3. Elimina las columnas en claro de "Emisor".
 *
 * Si hay credenciales guardadas y no hay llave, aborta sin tocar nada.
 * El migrador hace un pg_dump antes de aplicar.
 */
const { cifrar, descifrar, hayLlave } = require("../../utils/cifrado");

const CAMPOS = { clave_sol: "clave_sol_cifrada", client_secret: "client_secret_cifrado" };
const contexto = (emisorId, campo) => `emisor:${emisorId}:${campo}`;

async function up({ context: { sequelize } }) {
  await sequelize.transaction(async (transaction) => {
    const q = (sql, opts = {}) => sequelize.query(sql, { transaction, ...opts });

    await q(`CREATE TABLE IF NOT EXISTS "EmisorCredenciales" (
      emisor_id             INTEGER PRIMARY KEY REFERENCES "Emisor"(id) ON UPDATE CASCADE ON DELETE CASCADE,
      clave_sol_cifrada     TEXT,
      client_secret_cifrado TEXT,
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

    const [cols] = await q(`SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Emisor' AND column_name IN ('clave_sol', 'client_secret')`);
    if (!cols.length) return; // ya migrado

    const [emisores] = await q(`SELECT id, ${cols.map((c) => c.column_name).join(", ")} FROM "Emisor"`);
    const conSecretos = emisores.filter((e) => e.clave_sol || e.client_secret);
    if (conSecretos.length && !hayLlave()) {
      throw new Error(
        "Hay credenciales SUNAT guardadas y falta DATA_ENCRYPTION_KEY (32 bytes en base64). " +
        "Genérela con `openssl rand -base64 32`, agréguela al .env del backend (y guárdela fuera del servidor) y vuelva a migrar."
      );
    }

    for (const e of conSecretos) {
      const valores = {};
      for (const [campo, columna] of Object.entries(CAMPOS)) {
        valores[columna] = e[campo] ? cifrar(e[campo], contexto(e.id, campo)) : null;
      }
      await q(`INSERT INTO "EmisorCredenciales" (emisor_id, clave_sol_cifrada, client_secret_cifrado)
        VALUES (:id, :clave_sol_cifrada, :client_secret_cifrado)
        ON CONFLICT (emisor_id) DO UPDATE SET clave_sol_cifrada = EXCLUDED.clave_sol_cifrada,
          client_secret_cifrado = EXCLUDED.client_secret_cifrado, updated_at = now()`,
        { replacements: { id: e.id, ...valores } });
    }

    await q(`ALTER TABLE "Emisor" DROP COLUMN IF EXISTS clave_sol, DROP COLUMN IF EXISTS client_secret`);
  });
}

async function down({ context: { sequelize } }) {
  await sequelize.transaction(async (transaction) => {
    const q = (sql, opts = {}) => sequelize.query(sql, { transaction, ...opts });
    await q(`ALTER TABLE "Emisor" ADD COLUMN IF NOT EXISTS clave_sol VARCHAR(20), ADD COLUMN IF NOT EXISTS client_secret VARCHAR(200)`);
    const [filas] = await q(`SELECT * FROM "EmisorCredenciales"`);
    for (const f of filas) {
      const valores = {};
      for (const [campo, columna] of Object.entries(CAMPOS)) {
        valores[campo] = f[columna] ? descifrar(f[columna], contexto(f.emisor_id, campo)) : null;
      }
      await q(`UPDATE "Emisor" SET clave_sol = :clave_sol, client_secret = :client_secret WHERE id = :id`,
        { replacements: { id: f.emisor_id, ...valores } });
    }
    await q(`DROP TABLE IF EXISTS "EmisorCredenciales"`);
  });
}

module.exports = { up, down, contexto };
