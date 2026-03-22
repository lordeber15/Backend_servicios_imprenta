require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'servicios',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'servicios'
});

async function fixEnumConflict() {
  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL\n');

    // 1. Verificar tipos ENUM existentes
    console.log('📋 1. Verificando tipos ENUM existentes...');
    const { rows: enumTypes } = await client.query(`
      SELECT typname, enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE typname LIKE '%almanaque%' OR typname LIKE '%tipo%'
      ORDER BY typname, enumsortorder;
    `);

    if (enumTypes.length > 0) {
      console.log('   Tipos ENUM encontrados:');
      const grouped = {};
      enumTypes.forEach(row => {
        if (!grouped[row.typname]) grouped[row.typname] = [];
        grouped[row.typname].push(row.enumlabel);
      });

      Object.entries(grouped).forEach(([name, labels]) => {
        console.log(`   - ${name}: [${labels.join(', ')}]`);
      });
    }

    // 2. Eliminar tipo ENUM creado por Sequelize si existe
    console.log('\n📋 2. Eliminando tipo enum_almanaques_tipo si existe...');
    try {
      await client.query(`DROP TYPE IF EXISTS "public"."enum_almanaques_tipo" CASCADE;`);
      console.log('✅ Tipo enum_almanaques_tipo eliminado');
    } catch (e) {
      console.log('ℹ️  Tipo no existía o ya fue eliminado');
    }

    // 3. Verificar que la columna tipo existe y usa tipo_almanaque
    console.log('\n📋 3. Verificando columna tipo en almanaques...');
    const { rows: columns } = await client.query(`
      SELECT
        column_name,
        data_type,
        udt_name,
        column_default,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'almanaques'
      AND column_name = 'tipo';
    `);

    if (columns.length > 0) {
      console.log('✅ Columna tipo encontrada:');
      console.table(columns);

      // Si la columna no usa tipo_almanaque, la corregimos
      if (columns[0].udt_name !== 'tipo_almanaque') {
        console.log('\n⚠️  La columna no usa tipo_almanaque, corrigiendo...');

        await client.query(`
          ALTER TABLE almanaques
          ALTER COLUMN tipo TYPE tipo_almanaque
          USING tipo::text::tipo_almanaque;
        `);
        console.log('✅ Tipo de columna corregido');
      }
    } else {
      console.log('⚠️  Columna tipo no existe, ejecuta la migración primero');
    }

    // 4. Verificar datos en la tabla
    console.log('\n📋 4. Verificando datos en almanaques...');
    const { rows: data } = await client.query(`
      SELECT tipo, COUNT(*) as total
      FROM almanaques
      GROUP BY tipo;
    `);

    if (data.length > 0) {
      console.log('✅ Datos en almanaques:');
      console.table(data);
    } else {
      console.log('ℹ️  No hay datos en almanaques');
    }

    console.log('\n✅ Corrección completada exitosamente');
    console.log('\n📝 Próximos pasos:');
    console.log('   1. Reinicia el servidor: pm2 restart backend');
    console.log('   2. Verifica los logs: pm2 logs backend');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nDetalles:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixEnumConflict();
