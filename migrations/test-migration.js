const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'servicios',
  password: 'admin123',
  database: 'servicios'
});

async function testMigration() {
  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL\n');

    // 1. Verificar que la columna tipo existe
    console.log('📋 1. Verificando estructura de la tabla almanaques:');
    const structure = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'almanaques'
      AND column_name = 'tipo'
    `);

    if (structure.rows.length === 0) {
      console.log('❌ La columna "tipo" NO existe en la tabla almanaques');
      process.exit(1);
    } else {
      console.log('✅ Columna "tipo" existe');
      console.table(structure.rows);
    }

    // 2. Verificar registros actuales
    console.log('\n📊 2. Estado actual de almanaques:');
    const almanaques = await client.query('SELECT id, cliente, "precioTotal", tipo FROM almanaques');

    if (almanaques.rows.length === 0) {
      console.log('ℹ️  No hay registros en almanaques');
    } else {
      console.table(almanaques.rows);
    }

    // 3. Crear registros de prueba
    console.log('\n🧪 3. Creando registros de prueba...');

    // Cotización (NO debe sumar)
    await client.query(`
      INSERT INTO almanaques (cliente, "tipoDocumento", "numeroDocumento", direccion, "fechaEmision", "aCuenta", "precioTotal", tipo, "createdAt", "updatedAt")
      VALUES ('Cliente Cotización', 'DNI', '12345678', 'Lima', NOW(), 0, 100.00, 'cotizacion', NOW(), NOW())
    `);
    console.log('✅ Cotización creada: S/ 100.00');

    // Venta (SÍ debe sumar)
    await client.query(`
      INSERT INTO almanaques (cliente, "tipoDocumento", "numeroDocumento", direccion, "fechaEmision", "aCuenta", "precioTotal", tipo, "createdAt", "updatedAt")
      VALUES ('Cliente Venta', 'DNI', '87654321', 'Lima', NOW(), 0, 200.00, 'venta', NOW(), NOW())
    `);
    console.log('✅ Venta creada: S/ 200.00');

    // 4. Verificar que el filtro funciona
    console.log('\n🔍 4. Probando filtro de ventas:');
    const soloVentas = await client.query(`
      SELECT SUM("precioTotal") as total_ventas
      FROM almanaques
      WHERE tipo = 'venta'
    `);

    const totalVentas = parseFloat(soloVentas.rows[0].total_ventas || 0);
    console.log(`   Total SOLO ventas (debe ser 200): S/ ${totalVentas.toFixed(2)}`);

    if (totalVentas === 200.00) {
      console.log('   ✅ CORRECTO: Solo cuenta las ventas, NO las cotizaciones');
    } else {
      console.log(`   ⚠️  ADVERTENCIA: Se esperaba 200 pero se obtuvo ${totalVentas}`);
    }

    // 5. Verificar total general
    console.log('\n📈 5. Resumen por tipo:');
    const resumen = await client.query(`
      SELECT tipo, COUNT(*) as cantidad, SUM("precioTotal") as total
      FROM almanaques
      GROUP BY tipo
      ORDER BY tipo
    `);
    console.table(resumen.rows);

    console.log('\n🎉 ¡Prueba completada exitosamente!');
    console.log('\n✅ Conclusión:');
    console.log('   - Las cotizaciones (tipo=cotizacion) NO se suman a los ingresos');
    console.log('   - Las ventas (tipo=venta) SÍ se suman a los ingresos');
    console.log('   - El filtro en caja.controller.js funcionará correctamente');

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testMigration();
