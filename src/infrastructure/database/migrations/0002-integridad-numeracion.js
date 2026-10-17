/**
 * 0002 — Integridad de la numeración de comprobantes.
 *
 * Hasta ahora el correlativo lo enviaba el navegador y la serie solo avanzaba
 * cuando SUNAT aceptaba, así que dos emisiones podían tomar el mismo número.
 * Desde esta versión el backend reserva el número dentro de una transacción.
 * Esta migración agrega la garantía en la BD:
 *
 * 1. Verifica que no existan números duplicados. Si los hay, ABORTA y los
 *    lista: hay que resolverlos a mano (no se renumera nada automáticamente:
 *    un comprobante enviado a SUNAT no puede cambiar de número).
 * 2. Índices UNIQUE sobre la numeración de comprobantes, guías, resúmenes,
 *    bajas y series.
 * 3. Ajusta Serie.correlativo al siguiente número libre real.
 * 4. GuiaRemision.ticket: la guía se resuelve consultando el ticket a SUNAT.
 *    ComunicacionBajaDetalle.estado_previo: si SUNAT rechaza la baja, el
 *    comprobante vuelve a su estado anterior (ACEPTADO u OBSERVADO).
 * 5. Estado heredado "AN" → "ANULADO".
 */

const UNICOS = [
  {
    nombre: "comprobante_numeracion_unica",
    tabla: "Comprobante",
    columnas: ["emisor_id", "tipo_comprobante_id", "serie", "correlativo"],
  },
  {
    nombre: "guia_numeracion_unica",
    tabla: "GuiaRemision",
    columnas: ["emisor_id", "tipo_guia", "serie", "correlativo"],
  },
  {
    nombre: "envio_resumen_numeracion_unica",
    tabla: "EnvioResumen",
    columnas: ["emisor_id", "tipo", "fecha_referencia", "correlativo"],
  },
  {
    nombre: "comunicacion_baja_numeracion_unica",
    tabla: "ComunicacionBaja",
    columnas: ["emisor_id", "fecha_emision", "correlativo"],
  },
  {
    nombre: "serie_unica",
    tabla: "Serie",
    columnas: ["tipo_comprobante_id", "serie"],
  },
];

const q = (id) => `"${id}"`;

async function up({ context: { sequelize } }) {
  await sequelize.transaction(async (transaction) => {
    const opts = { transaction };

    // ── 1. Duplicados existentes ──────────────────────────────────────────
    const conflictos = [];
    for (const u of UNICOS) {
      const cols = u.columnas.map(q).join(", ");
      const noNulos = u.columnas.map((c) => `${q(c)} IS NOT NULL`).join(" AND ");
      const [filas] = await sequelize.query(
        `SELECT ${cols}, count(*)::int AS veces, array_agg(id ORDER BY id) AS ids
         FROM ${q(u.tabla)} WHERE ${noNulos}
         GROUP BY ${cols} HAVING count(*) > 1`,
        opts
      );
      for (const f of filas) {
        const clave = u.columnas.map((c) => `${c}=${f[c]}`).join(" ");
        conflictos.push(`${u.tabla}: ${clave} → ${f.veces} registros (ids ${f.ids.join(", ")})`);
      }
    }
    if (conflictos.length) {
      throw new Error(
        "Hay numeración duplicada; no se pueden crear los índices únicos. " +
        "Revise cada caso (cuál fue aceptado por SUNAT) y corrija o elimine los duplicados no enviados:\n  - " +
        conflictos.join("\n  - ")
      );
    }

    // ── 2. Índices únicos ─────────────────────────────────────────────────
    for (const u of UNICOS) {
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${q(u.nombre)} ON ${q(u.tabla)} (${u.columnas.map(q).join(", ")})`,
        opts
      );
    }

    // ── 3. Serie.correlativo = siguiente número libre ─────────────────────
    // Nunca retrocede: GREATEST con el valor actual.
    await sequelize.query(
      `UPDATE "Serie" s SET correlativo = GREATEST(
         COALESCE(s.correlativo, 1),
         COALESCE((SELECT max(c.correlativo) + 1 FROM "Comprobante" c
                   WHERE c.serie_id = s.id
                      OR (c.serie = s.serie AND c.tipo_comprobante_id = s.tipo_comprobante_id)), 1),
         COALESCE((SELECT max(g.correlativo) + 1 FROM "GuiaRemision" g
                   WHERE g.serie = s.serie AND g.tipo_guia = s.tipo_comprobante_id), 1)
       )`,
      opts
    );

    // ── 4. Ticket de la guía (consulta asíncrona del CDR) ─────────────────
    await sequelize.query(`ALTER TABLE "GuiaRemision" ADD COLUMN IF NOT EXISTS ticket VARCHAR(60)`, opts);
    await sequelize.query(
      `ALTER TABLE "ComunicacionBajaDetalle" ADD COLUMN IF NOT EXISTS estado_previo VARCHAR(15)`, opts);

    // ── 5. Estado heredado ────────────────────────────────────────────────
    await sequelize.query(`UPDATE "Comprobante" SET estado_sunat = 'ANULADO' WHERE estado_sunat = 'AN'`, opts);
  });
}

async function down({ context: { sequelize } }) {
  await sequelize.transaction(async (transaction) => {
    for (const u of UNICOS) {
      await sequelize.query(`DROP INDEX IF EXISTS ${q(u.nombre)}`, { transaction });
    }
    await sequelize.query(`ALTER TABLE "GuiaRemision" DROP COLUMN IF EXISTS ticket`, { transaction });
    await sequelize.query(`ALTER TABLE "ComunicacionBajaDetalle" DROP COLUMN IF EXISTS estado_previo`, { transaction });
    // Serie.correlativo y los estados ANULADO no se revierten: son datos correctos.
  });
}

module.exports = { up, down };
