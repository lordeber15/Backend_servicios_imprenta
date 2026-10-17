#!/usr/bin/env node
/**
 * MIGRACIÓN: Asignar metodo_pago a Comprobantes
 *
 * Actualiza los comprobantes que no tienen metodo_pago asignado.
 * Esto es necesario para que los comprobantes importados desde XML
 * se sumen correctamente en el cálculo de caja/ingresos diarios.
 *
 * Reglas:
 * - Si forma_pago = "Contado" → metodo_pago = "Efectivo"
 * - Si forma_pago = "Crédito" → metodo_pago = "Efectivo" (por defecto)
 * - Si ya tiene metodo_pago → no se modifica
 */

require('dotenv').config();
const sequelize = require('./src/infrastructure/database/database');
const Comprobante = require('./src/infrastructure/database/models/facturacion/comprobante');

async function migrarMetodoPago() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║    MIGRACIÓN: Asignar metodo_pago a Comprobantes         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    await sequelize.authenticate();
    console.log('✅ Conectado a la base de datos\n');

    // ────────────────────────────────────────────────────────────────────
    // 1. Contar comprobantes sin metodo_pago
    // ────────────────────────────────────────────────────────────────────
    console.log('📊 Analizando comprobantes...\n');

    const sinMetodoPago = await Comprobante.count({
      where: {
        metodo_pago: null
      }
    });

    const conMetodoPago = await Comprobante.count({
      where: {
        metodo_pago: { [require('sequelize').Op.ne]: null }
      }
    });

    console.log(`Comprobantes SIN metodo_pago:  ${sinMetodoPago}`);
    console.log(`Comprobantes CON metodo_pago:  ${conMetodoPago}`);
    console.log(`Total comprobantes:             ${sinMetodoPago + conMetodoPago}\n`);

    if (sinMetodoPago === 0) {
      console.log('✅ Todos los comprobantes ya tienen metodo_pago asignado.');
      console.log('   No es necesario ejecutar la migración.\n');
      return;
    }

    // ────────────────────────────────────────────────────────────────────
    // 2. Mostrar vista previa de cambios
    // ────────────────────────────────────────────────────────────────────
    console.log('📋 Vista previa de cambios:\n');
    console.log('─'.repeat(60));

    const comprobantes = await Comprobante.findAll({
      attributes: ['id', 'serie', 'correlativo', 'forma_pago', 'metodo_pago', 'total'],
      where: { metodo_pago: null },
      limit: 10,
      raw: true
    });

    comprobantes.forEach(c => {
      const nuevoMetodo = determinarMetodoPago(c.forma_pago);
      console.log(
        `${c.serie}-${String(c.correlativo).padStart(8, '0')} | ` +
        `forma_pago: ${(c.forma_pago || 'NULL').padEnd(10)} → ` +
        `metodo_pago: ${nuevoMetodo.padEnd(10)} | ` +
        `S/ ${parseFloat(c.total).toFixed(2)}`
      );
    });

    if (sinMetodoPago > 10) {
      console.log(`... y ${sinMetodoPago - 10} comprobantes más`);
    }

    console.log('─'.repeat(60));

    // ────────────────────────────────────────────────────────────────────
    // 3. Solicitar confirmación
    // ────────────────────────────────────────────────────────────────────
    console.log('\n⚠️  Esta migración actualizará los comprobantes mostrados.');
    console.log('⚠️  Los comprobantes podrán sumarse en el cálculo de caja.\n');

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const confirmar = await new Promise(resolve => {
      readline.question('¿Continuar con la migración? (si/no): ', answer => {
        readline.close();
        resolve(answer.toLowerCase());
      });
    });

    if (confirmar !== 'si' && confirmar !== 's' && confirmar !== 'yes' && confirmar !== 'y') {
      console.log('\n❌ Migración cancelada por el usuario.\n');
      return;
    }

    // ────────────────────────────────────────────────────────────────────
    // 4. Ejecutar migración
    // ────────────────────────────────────────────────────────────────────
    console.log('\n🔄 Ejecutando migración...\n');

    const todosComprobantes = await Comprobante.findAll({
      where: { metodo_pago: null }
    });

    let actualizados = 0;
    let errores = 0;

    for (const comprobante of todosComprobantes) {
      try {
        const nuevoMetodo = determinarMetodoPago(comprobante.forma_pago);

        await comprobante.update({
          metodo_pago: nuevoMetodo
        });

        actualizados++;

        if (actualizados % 10 === 0) {
          process.stdout.write(`   Procesados: ${actualizados}/${todosComprobantes.length}\r`);
        }

      } catch (error) {
        console.error(`   ❌ Error actualizando comprobante ID ${comprobante.id}:`, error.message);
        errores++;
      }
    }

    console.log(`   Procesados: ${actualizados}/${todosComprobantes.length}`);

    // ────────────────────────────────────────────────────────────────────
    // 5. Resumen final
    // ────────────────────────────────────────────────────────────────────
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                      RESUMEN                              ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log(`✅ Comprobantes actualizados:  ${actualizados}`);
    console.log(`❌ Errores:                    ${errores}`);
    console.log(`📊 Total procesados:           ${actualizados + errores}\n`);

    // ────────────────────────────────────────────────────────────────────
    // 6. Verificar actualización
    // ────────────────────────────────────────────────────────────────────
    console.log('🔍 Verificando actualización...\n');

    const sinMetodoDespues = await Comprobante.count({
      where: { metodo_pago: null }
    });

    const conMetodoDespues = await Comprobante.count({
      where: { metodo_pago: { [require('sequelize').Op.ne]: null } }
    });

    console.log(`Comprobantes SIN metodo_pago:  ${sinMetodoDespues}`);
    console.log(`Comprobantes CON metodo_pago:  ${conMetodoDespues}\n`);

    if (sinMetodoDespues === 0) {
      console.log('✅ ¡Migración completada exitosamente!');
      console.log('✅ Todos los comprobantes ahora tienen metodo_pago asignado.');
      console.log('✅ Los comprobantes se sumarán correctamente en la caja.\n');
    } else {
      console.log(`⚠️  Quedan ${sinMetodoDespues} comprobantes sin metodo_pago.`);
      console.log('   Revisa los errores y ejecuta la migración nuevamente.\n');
    }

    // ────────────────────────────────────────────────────────────────────
    // 7. Mostrar resumen de ventas por método
    // ────────────────────────────────────────────────────────────────────
    console.log('💰 RESUMEN DE VENTAS POR MÉTODO DE PAGO\n');
    console.log('─'.repeat(60));

    const ventasPorMetodo = await Comprobante.findAll({
      attributes: [
        'metodo_pago',
        [sequelize.fn('COUNT', sequelize.col('id')), 'cantidad'],
        [sequelize.fn('SUM', sequelize.col('total')), 'total']
      ],
      where: {
        tipo_comprobante_id: { [require('sequelize').Op.in]: ['01', '03'] }, // Solo facturas y boletas
        metodo_pago: { [require('sequelize').Op.ne]: null }
      },
      group: ['metodo_pago'],
      raw: true
    });

    if (ventasPorMetodo.length === 0) {
      console.log('   No hay datos para mostrar\n');
    } else {
      ventasPorMetodo.forEach(v => {
        const metodo = (v.metodo_pago || 'Sin método').padEnd(12);
        const cantidad = String(v.cantidad).padStart(3);
        const total = `S/ ${parseFloat(v.total || 0).toFixed(2)}`.padStart(12);

        console.log(`${metodo} | Cantidad: ${cantidad} | Total: ${total}`);
      });
    }

    console.log('─'.repeat(60));
    console.log('\n📝 Próximos pasos:');
    console.log('   1. Verifica el cálculo de caja actual');
    console.log('   2. Los comprobantes importados ahora sumarán correctamente');
    console.log('   3. Ejecuta: node verify_imported_data.js para verificar\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

/**
 * Determina el método de pago basándose en forma_pago
 */
function determinarMetodoPago(formaPago) {
  // Si no tiene forma_pago, asignar Efectivo por defecto
  if (!formaPago) return 'Efectivo';

  // Normalizar
  const forma = formaPago.toLowerCase().trim();

  // Mapeo
  if (forma === 'contado') return 'Efectivo';
  if (forma === 'credito' || forma === 'crédito') return 'Efectivo'; // Por defecto

  // Por defecto: Efectivo
  return 'Efectivo';
}

// Ejecutar
if (require.main === module) {
  migrarMetodoPago();
}

module.exports = { migrarMetodoPago };
