/**
 * 0003 — Caja global vinculada a cada movimiento.
 *
 * Antes la caja sumaba ventas por FECHA/HORA (tickets por createdAt,
 * comprobantes por fecha_emision ≥ fecha de apertura), así que entraban
 * ventas de antes de abrir, y no se restaban notas de crédito ni egresos.
 * Ahora cada venta/movimiento guarda el caja_id de la caja abierta.
 *
 * 1. Verifica que haya como máximo UNA caja abierta (si no, aborta y las lista).
 * 2. Índice único parcial: la BD garantiza una sola caja abierta.
 * 3. caja_id en Tickets, Comprobante, almanaque, ingresos y egresos.
 * 4. Auditoría de la caja: quién abrió/cerró, cuándo cerró y el desglose
 *    congelado al cierre (JSONB).
 * 5. Tickets.monto_cobrado: lo que realmente se cobró (en servicios es el
 *    adelanto, no el total). Se rellena desde los detalles.
 * 6. Vincula a la caja abierta (si la hay) los movimientos posteriores a su
 *    apertura. Las cajas ya cerradas conservan sus totales guardados.
 * 7. CHECK de metodo_pago (NOT VALID: no revalida filas viejas).
 */
const TABLAS_CAJA = ["Tickets", "Comprobante", "almanaque", "ingresos", "egresos"];
const METODOS = ["Efectivo", "Yape", "Plin", "Tarjeta", "Transferencia"];

async function up({ context: { sequelize } }) {
  await sequelize.transaction(async (transaction) => {
    const q = (sql, opts = {}) => sequelize.query(sql, { transaction, ...opts });

    // ── 1. Una sola caja abierta ──────────────────────────────────────────
    const [abiertas] = await q(`SELECT id, fecha_apertura, hora_apertura FROM "AperturaCajas" WHERE estado = 'abierta' ORDER BY id`);
    if (abiertas.length > 1) {
      throw new Error(
        "Hay más de una caja abierta; cierre las sobrantes antes de migrar:\n  - " +
        abiertas.map((c) => `caja ${c.id} (${c.fecha_apertura} ${c.hora_apertura || ""})`).join("\n  - ")
      );
    }

    // ── 2. Garantía en BD ─────────────────────────────────────────────────
    await q(`CREATE UNIQUE INDEX IF NOT EXISTS caja_una_abierta ON "AperturaCajas" ((true)) WHERE estado = 'abierta'`);

    // ── 3. caja_id en cada movimiento ─────────────────────────────────────
    for (const t of TABLAS_CAJA) {
      await q(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS caja_id INTEGER REFERENCES "AperturaCajas"(id) ON UPDATE CASCADE ON DELETE SET NULL`);
      await q(`CREATE INDEX IF NOT EXISTS "${t}_caja_id_idx" ON "${t}" (caja_id)`);
    }

    // ── 4. Auditoría de la caja ───────────────────────────────────────────
    await q(`ALTER TABLE "AperturaCajas"
      ADD COLUMN IF NOT EXISTS usuario_apertura_id INTEGER REFERENCES logins(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS usuario_cierre_id   INTEGER REFERENCES logins(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS cerrada_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS desglose   JSONB`);

    // ── 5. Lo efectivamente cobrado en cada ticket ────────────────────────
    await q(`ALTER TABLE "Tickets" ADD COLUMN IF NOT EXISTS monto_cobrado NUMERIC(11,2)`);
    await q(`UPDATE "Tickets" t SET monto_cobrado = sub.m
      FROM (SELECT "ticketId",
                   ROUND(SUM(CASE WHEN es_servicio THEN COALESCE(adelanto, 0) ELSE subtotal END)::numeric, 2) AS m
            FROM "DetalleTickets" GROUP BY "ticketId") sub
      WHERE sub."ticketId" = t.id AND t.monto_cobrado IS NULL`);

    // ── 6. Movimientos de la caja abierta actual ──────────────────────────
    if (abiertas.length === 1) {
      const id = abiertas[0].id;
      const repl = { replacements: { id } };
      const desde = `(SELECT "createdAt" FROM "AperturaCajas" WHERE id = :id)`;
      await q(`UPDATE "Tickets" SET caja_id = :id WHERE caja_id IS NULL AND "createdAt" >= ${desde}`, repl);
      await q(`UPDATE "almanaque" SET caja_id = :id WHERE caja_id IS NULL AND tipo = 'venta' AND "createdAt" >= ${desde}`, repl);
      await q(`UPDATE "ingresos" SET caja_id = :id WHERE caja_id IS NULL AND "createdAt" >= ${desde}`, repl);
      await q(`UPDATE "egresos" SET caja_id = :id WHERE caja_id IS NULL AND "createdAt" >= ${desde}`, repl);
      // Comprobante no tiene createdAt: mismo criterio que usaba la caja (fecha de emisión).
      await q(`UPDATE "Comprobante" SET caja_id = :id
        WHERE caja_id IS NULL AND tipo_comprobante_id IN ('01','03','07')
          AND fecha_emision >= (SELECT fecha_apertura FROM "AperturaCajas" WHERE id = :id)`, repl);
    }

    // ── 7. Métodos de pago válidos (solo filas nuevas) ────────────────────
    const lista = METODOS.map((m) => `'${m}'`).join(", ");
    for (const t of ["Tickets", "Comprobante"]) {
      await q(`ALTER TABLE "${t}" DROP CONSTRAINT IF EXISTS "${t}_metodo_pago_valido"`);
      await q(`ALTER TABLE "${t}" ADD CONSTRAINT "${t}_metodo_pago_valido"
        CHECK (metodo_pago IS NULL OR metodo_pago IN (${lista})) NOT VALID`);
    }
  });
}

async function down({ context: { sequelize } }) {
  await sequelize.transaction(async (transaction) => {
    const q = (sql) => sequelize.query(sql, { transaction });
    for (const t of ["Tickets", "Comprobante"]) await q(`ALTER TABLE "${t}" DROP CONSTRAINT IF EXISTS "${t}_metodo_pago_valido"`);
    await q(`ALTER TABLE "Tickets" DROP COLUMN IF EXISTS monto_cobrado`);
    await q(`ALTER TABLE "AperturaCajas" DROP COLUMN IF EXISTS usuario_apertura_id, DROP COLUMN IF EXISTS usuario_cierre_id,
             DROP COLUMN IF EXISTS cerrada_at, DROP COLUMN IF EXISTS desglose`);
    for (const t of TABLAS_CAJA) await q(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS caja_id`);
    await q(`DROP INDEX IF EXISTS caja_una_abierta`);
  });
}

module.exports = { up, down };
