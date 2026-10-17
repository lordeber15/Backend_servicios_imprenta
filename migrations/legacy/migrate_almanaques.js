require('dotenv').config();
const sequelize = require('./src/infrastructure/database/database.js');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('✅ DB connected');

    // Paso 1: Crear tipo ENUM
    try {
      await sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE tipo_almanaque AS ENUM ('cotizacion', 'venta');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      console.log('✅ Tipo ENUM "tipo_almanaque" creado o ya existe');
    } catch (e) {
      console.log('⚠️  Error creando tipo ENUM:', e.message);
    }

    // Paso 2: Agregar columna tipo
    try {
      await sequelize.query(`
        ALTER TABLE almanaques
        ADD COLUMN tipo tipo_almanaque NOT NULL DEFAULT 'cotizacion';
      `);
      console.log('✅ Columna "tipo" agregada a tabla almanaques');
    } catch (e) {
      console.log('⚠️  almanaques ya tiene la columna "tipo":', e.message);
    }

    // Paso 3: Agregar comentario a la columna
    try {
      await sequelize.query(`
        COMMENT ON COLUMN almanaques.tipo IS 'Tipo de almanaque: cotizacion (no suma a ingresos) o venta (suma a ingresos)';
      `);
      console.log('✅ Comentario agregado a la columna');
    } catch (e) {
      console.log('⚠️  Error agregando comentario:', e.message);
    }

    // Paso 4: Marcar registros existentes como 'cotizacion'
    try {
      const result = await sequelize.query(`
        UPDATE almanaques
        SET tipo = 'cotizacion'
        WHERE tipo IS NULL;
      `);
      console.log('✅ Registros existentes marcados como "cotizacion"');
    } catch (e) {
      console.log('⚠️  Error actualizando registros:', e.message);
    }

    // Verificación
    const [results] = await sequelize.query(`
      SELECT tipo, COUNT(*) as total
      FROM almanaques
      GROUP BY tipo;
    `);

    console.log('\n📊 Estado actual de almanaques:');
    console.table(results);

    console.log('\n✅ Migración completada exitosamente');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error en la migración:', e);
    process.exit(1);
  }
}

migrate();
