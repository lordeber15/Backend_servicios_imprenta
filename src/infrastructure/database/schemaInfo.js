/**
 * INTROSPECCIÓN DEL ESQUEMA
 *
 * Lee tablas y columnas reales del schema "public" para compararlas con el
 * esquema esperado por el código (baseline). Lo usan el generador del
 * baseline y los comandos `diff` / `baseline` del migrador.
 */

// Tablas propias del migrador: no forman parte del esquema de negocio.
const TABLAS_IGNORADAS = new Set(["SequelizeMeta"]);

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @returns {Promise<Record<string, Record<string, {tipo: string, nulo: boolean}>>>}
 */
async function leerEsquema(sequelize) {
  const [filas] = await sequelize.query(`
    SELECT c.table_name, c.column_name, c.udt_name, c.is_nullable
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    ORDER BY c.table_name, c.ordinal_position
  `);

  const esquema = {};
  for (const f of filas) {
    if (TABLAS_IGNORADAS.has(f.table_name)) continue;
    esquema[f.table_name] ??= {};
    esquema[f.table_name][f.column_name] = {
      tipo: f.udt_name,
      nulo: f.is_nullable === "YES",
    };
  }
  return esquema;
}

/**
 * Compara el esquema real con el esperado.
 * - faltantes: lo que el código necesita y la BD no tiene → bloquea el baseline.
 * - tipos:     columnas con otro tipo → bloquea (puede romper consultas).
 * - sobrantes: lo que la BD tiene de más → solo aviso (datos viejos, no rompe).
 */
function compararEsquemas(real, esperado) {
  const resultado = { tablasFaltantes: [], columnasFaltantes: [], tipos: [], sobrantes: [] };

  for (const [tabla, columnas] of Object.entries(esperado)) {
    if (!real[tabla]) {
      resultado.tablasFaltantes.push(tabla);
      continue;
    }
    for (const [col, def] of Object.entries(columnas)) {
      const r = real[tabla][col];
      if (!r) resultado.columnasFaltantes.push(`${tabla}.${col} (${def.tipo})`);
      // Los ENUM de Sequelize se llaman enum_<Tabla>_<col>; basta con que ambos sean enum.
      else if (r.tipo !== def.tipo && !(r.tipo.startsWith("enum_") && def.tipo.startsWith("enum_"))) {
        resultado.tipos.push(`${tabla}.${col}: BD=${r.tipo}, esperado=${def.tipo}`);
      }
    }
  }
  for (const [tabla, columnas] of Object.entries(real)) {
    if (!esperado[tabla]) {
      resultado.sobrantes.push(`tabla ${tabla}`);
      continue;
    }
    for (const col of Object.keys(columnas)) {
      if (!esperado[tabla][col]) resultado.sobrantes.push(`${tabla}.${col}`);
    }
  }

  resultado.compatible =
    !resultado.tablasFaltantes.length && !resultado.columnasFaltantes.length && !resultado.tipos.length;
  return resultado;
}

module.exports = { leerEsquema, compararEsquemas };
