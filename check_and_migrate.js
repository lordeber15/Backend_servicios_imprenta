require('dotenv').config();
const sequelize = require('./src/infrastructure/database/database.js');

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m',
};

function log(color, icon, message) {
  console.log(`${colors[color]}${icon} ${message}${colors.reset}`);
}

async function checkAndMigrate() {
  try {
    await sequelize.authenticate();
    log('green', '✅', 'Conectado a la base de datos\n');

    let migrationsApplied = 0;
    let migrationsSkipped = 0;

    // =================================================================
    // MIGRACIÓN 1: metodo_pago en Tickets
    // =================================================================
    log('blue', '📋', '1. Verificando columna metodo_pago en Tickets...');

    const [ticketsColumns] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Tickets'
      AND column_name = 'metodo_pago';
    `);

    if (ticketsColumns.length === 0) {
      log('yellow', '⚠️', '  Columna no existe. Aplicando migración...');
      await sequelize.query(`
        ALTER TABLE "Tickets"
        ADD COLUMN metodo_pago VARCHAR(50) DEFAULT 'Efectivo';
      `);
      log('green', '✅', '  Columna metodo_pago agregada a Tickets');
      migrationsApplied++;
    } else {
      log('green', '✓', '  Ya existe. Omitiendo...');
      migrationsSkipped++;
    }

    // =================================================================
    // MIGRACIÓN 2: metodo_pago en Comprobante
    // =================================================================
    log('blue', '📋', '2. Verificando columna metodo_pago en Comprobante...');

    const [comprobanteColumns] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Comprobante'
      AND column_name = 'metodo_pago';
    `);

    if (comprobanteColumns.length === 0) {
      log('yellow', '⚠️', '  Columna no existe. Aplicando migración...');
      await sequelize.query(`
        ALTER TABLE "Comprobante"
        ADD COLUMN metodo_pago VARCHAR(50) DEFAULT 'Efectivo';
      `);
      log('green', '✅', '  Columna metodo_pago agregada a Comprobante');
      migrationsApplied++;
    } else {
      log('green', '✓', '  Ya existe. Omitiendo...');
      migrationsSkipped++;
    }

    // =================================================================
    // MIGRACIÓN 3: Tipo ENUM tipo_almanaque
    // =================================================================
    log('blue', '📋', '3. Verificando tipo ENUM tipo_almanaque...');

    const [enumExists] = await sequelize.query(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'tipo_almanaque'
      ) as exists;
    `);

    if (!enumExists[0].exists) {
      log('yellow', '⚠️', '  Tipo ENUM no existe. Creando...');
      await sequelize.query(`
        CREATE TYPE tipo_almanaque AS ENUM ('cotizacion', 'venta');
      `);
      log('green', '✅', '  Tipo ENUM tipo_almanaque creado');
      migrationsApplied++;
    } else {
      log('green', '✓', '  Ya existe. Omitiendo...');
      migrationsSkipped++;
    }

    // =================================================================
    // MIGRACIÓN 4: Columna tipo en almanaques
    // =================================================================
    log('blue', '📋', '4. Verificando columna tipo en almanaques...');

    const [almanaquesColumns] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'almanaques'
      AND column_name = 'tipo';
    `);

    if (almanaquesColumns.length === 0) {
      log('yellow', '⚠️', '  Columna no existe. Aplicando migración...');

      // Agregar columna
      await sequelize.query(`
        ALTER TABLE almanaques
        ADD COLUMN tipo tipo_almanaque NOT NULL DEFAULT 'cotizacion';
      `);
      log('green', '✅', '  Columna tipo agregada a almanaques');

      // Agregar comentario
      await sequelize.query(`
        COMMENT ON COLUMN almanaques.tipo IS 'Tipo de almanaque: cotizacion (no suma a ingresos) o venta (suma a ingresos)';
      `);
      log('green', '✅', '  Comentario agregado a la columna');

      // Actualizar registros existentes
      const [updateResult] = await sequelize.query(`
        UPDATE almanaques
        SET tipo = 'cotizacion'
        WHERE tipo IS NULL;
      `);
      log('green', '✅', '  Registros existentes marcados como cotizacion');

      migrationsApplied++;
    } else {
      log('green', '✓', '  Ya existe. Omitiendo...');
      migrationsSkipped++;
    }

    // =================================================================
    // RESUMEN
    // =================================================================
    console.log('\n' + '='.repeat(60));
    log('blue', '📊', 'RESUMEN DE MIGRACIONES');
    console.log('='.repeat(60));

    log('green', '✅', `Migraciones aplicadas: ${migrationsApplied}`);
    log('yellow', '⏭️', `Migraciones omitidas: ${migrationsSkipped}`);

    // =================================================================
    // VERIFICACIÓN FINAL
    // =================================================================
    console.log('\n' + '='.repeat(60));
    log('blue', '🔍', 'VERIFICACIÓN FINAL');
    console.log('='.repeat(60));

    // Verificar almanaques
    const [almanaques] = await sequelize.query(`
      SELECT tipo, COUNT(*) as total
      FROM almanaques
      GROUP BY tipo
      ORDER BY tipo;
    `);

    if (almanaques.length > 0) {
      console.log('\n📊 Estado de almanaques:');
      console.table(almanaques);
    } else {
      log('blue', 'ℹ️', 'No hay registros en almanaques');
    }

    // Verificar estructura de Tickets
    const [ticketsMetodo] = await sequelize.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'Tickets'
      AND column_name = 'metodo_pago';
    `);

    if (ticketsMetodo.length > 0) {
      log('green', '✅', 'Tickets.metodo_pago: OK');
    }

    // Verificar estructura de Comprobante
    const [comprobanteMetodo] = await sequelize.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'Comprobante'
      AND column_name = 'metodo_pago';
    `);

    if (comprobanteMetodo.length > 0) {
      log('green', '✅', 'Comprobante.metodo_pago: OK');
    }

    // Verificar estructura de almanaques
    const [almanaqueTipo] = await sequelize.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'almanaques'
      AND column_name = 'tipo';
    `);

    if (almanaqueTipo.length > 0) {
      log('green', '✅', 'almanaques.tipo: OK');
    }

    console.log('\n' + '='.repeat(60));
    log('green', '🎉', 'TODAS LAS MIGRACIONES ESTÁN APLICADAS');
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  } catch (e) {
    console.error('\n' + '='.repeat(60));
    log('red', '❌', 'ERROR EN LAS MIGRACIONES');
    console.error('='.repeat(60));
    console.error('\n', e);
    console.log('\n');
    process.exit(1);
  }
}

checkAndMigrate();
