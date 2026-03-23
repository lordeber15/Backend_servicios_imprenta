#!/usr/bin/env node
/**
 * VERIFICADOR DE DATOS IMPORTADOS
 *
 * Muestra un resumen de los comprobantes, series y clientes
 * importados desde los archivos XML.
 */

require('dotenv').config();
const sequelize = require('./src/infrastructure/database/database');
const Comprobante = require('./src/infrastructure/database/models/facturacion/comprobante');
const Detalle = require('./src/infrastructure/database/models/facturacion/detalles');
const Serie = require('./src/infrastructure/database/models/facturacion/serie');
const Cliente = require('./src/infrastructure/database/models/facturacion/cliente');

async function verificarDatos() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         VERIFICACIÓN DE DATOS IMPORTADOS                  ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    await sequelize.authenticate();
    console.log('✅ Conectado a la base de datos\n');

    // ────────────────────────────────────────────────────────────────────
    // 1. RESUMEN GENERAL
    // ────────────────────────────────────────────────────────────────────
    console.log('📊 RESUMEN GENERAL');
    console.log('─'.repeat(60));

    const totalComprobantes = await Comprobante.count();
    const totalClientes = await Cliente.count();
    const totalSeries = await Serie.count();

    console.log(`Comprobantes:  ${totalComprobantes}`);
    console.log(`Clientes:      ${totalClientes}`);
    console.log(`Series:        ${totalSeries}\n`);

    // ────────────────────────────────────────────────────────────────────
    // 2. SERIES ACTIVAS
    // ────────────────────────────────────────────────────────────────────
    console.log('📋 SERIES ACTIVAS');
    console.log('─'.repeat(60));

    const series = await Serie.findAll({
      attributes: ['tipo_comprobante_id', 'serie', 'correlativo'],
      order: [['tipo_comprobante_id', 'ASC'], ['serie', 'ASC']]
    });

    const tipoNombres = {
      '01': 'Factura',
      '03': 'Boleta',
      '07': 'N. Crédito',
      '08': 'N. Débito',
      '09': 'Guía Rem.',
      '31': 'Guía Transp.'
    };

    series.forEach(s => {
      const tipo = tipoNombres[s.tipo_comprobante_id] || s.tipo_comprobante_id;
      console.log(`${tipo.padEnd(12)} | ${s.serie} | Correlativo: ${String(s.correlativo).padStart(8, '0')}`);
    });

    // ────────────────────────────────────────────────────────────────────
    // 3. ÚLTIMOS COMPROBANTES
    // ────────────────────────────────────────────────────────────────────
    console.log('\n📄 ÚLTIMOS 10 COMPROBANTES');
    console.log('─'.repeat(60));

    const comprobantes = await Comprobante.findAll({
      attributes: ['id', 'serie', 'correlativo', 'fecha_emision', 'total', 'estado_sunat', 'cliente_id'],
      order: [['fecha_emision', 'DESC']],
      limit: 10,
      raw: true
    });

    if (comprobantes.length === 0) {
      console.log('⚠️  No hay comprobantes registrados\n');
    } else {
      for (const c of comprobantes) {
        const fecha = c.fecha_emision ? new Date(c.fecha_emision).toLocaleDateString('es-PE') : 'N/A';

        // Buscar cliente si existe
        let clienteNombre = 'Sin cliente';
        if (c.cliente_id) {
          const cliente = await Cliente.findByPk(c.cliente_id, { raw: true });
          if (cliente) {
            clienteNombre = (cliente.razon_social || 'Sin nombre').substring(0, 25);
          }
        }

        const total = `S/ ${parseFloat(c.total).toFixed(2)}`;
        console.log(`${c.serie}-${String(c.correlativo).padStart(8, '0')} | ${fecha} | ${total.padStart(10)} | ${clienteNombre}`);
      }
    }

    // ────────────────────────────────────────────────────────────────────
    // 4. TOTALES POR TIPO DE COMPROBANTE
    // ────────────────────────────────────────────────────────────────────
    console.log('\n💰 TOTALES POR TIPO DE COMPROBANTE');
    console.log('─'.repeat(60));

    const totalesPorTipo = await Comprobante.findAll({
      attributes: [
        'tipo_comprobante_id',
        [sequelize.fn('COUNT', sequelize.col('id')), 'cantidad'],
        [sequelize.fn('SUM', sequelize.col('total')), 'total']
      ],
      group: ['tipo_comprobante_id'],
      raw: true
    });

    if (totalesPorTipo.length === 0) {
      console.log('⚠️  No hay datos para mostrar\n');
    } else {
      totalesPorTipo.forEach(t => {
        const tipo = tipoNombres[t.tipo_comprobante_id] || t.tipo_comprobante_id;
        const cantidad = String(t.cantidad).padStart(3);
        const total = `S/ ${parseFloat(t.total || 0).toFixed(2)}`.padStart(12);

        console.log(`${tipo.padEnd(12)} | Cantidad: ${cantidad} | Total: ${total}`);
      });
    }

    // ────────────────────────────────────────────────────────────────────
    // 5. CLIENTES REGISTRADOS
    // ────────────────────────────────────────────────────────────────────
    console.log('\n👥 CLIENTES REGISTRADOS (últimos 10)');
    console.log('─'.repeat(60));

    const clientes = await Cliente.findAll({
      attributes: ['id', 'nrodoc', 'razon_social', 'tipo_documento_id'],
      order: [['id', 'DESC']],
      limit: 10
    });

    if (clientes.length === 0) {
      console.log('⚠️  No hay clientes registrados\n');
    } else {
      clientes.forEach(cl => {
        const tipoDoc = cl.tipo_documento_id === '6' ? 'RUC' : 'DNI';
        const nrodoc = cl.nrodoc || 'N/A';
        const razonSocial = (cl.razon_social || 'Sin nombre').substring(0, 40);

        console.log(`ID ${String(cl.id).padStart(4)} | ${tipoDoc} ${nrodoc.padEnd(12)} | ${razonSocial}`);
      });
    }

    // ────────────────────────────────────────────────────────────────────
    // 6. VERIFICAR INTEGRIDAD
    // ────────────────────────────────────────────────────────────────────
    console.log('\n🔍 VERIFICACIÓN DE INTEGRIDAD');
    console.log('─'.repeat(60));

    // Comprobantes sin detalles
    const todosComprobantes = await Comprobante.findAll({ attributes: ['id'], raw: true });
    let sinDetalles = 0;

    for (const comp of todosComprobantes) {
      const detalles = await Detalle.count({ where: { comprobante_id: comp.id } });
      if (detalles === 0) sinDetalles++;
    }

    // Comprobantes sin cliente
    const sinCliente = await Comprobante.count({
      where: { cliente_id: null }
    });

    // Comprobantes sin serie
    const sinSerie = await Comprobante.count({
      where: { serie_id: null }
    });

    console.log(`Comprobantes sin detalles:  ${sinDetalles > 0 ? '⚠️  ' + sinDetalles : '✅ 0'}`);
    console.log(`Comprobantes sin cliente:   ${sinCliente > 0 ? '⚠️  ' + sinCliente : '✅ 0'}`);
    console.log(`Comprobantes sin serie_id:  ${sinSerie > 0 ? '⚠️  ' + sinSerie : '✅ 0'}`);

    // ────────────────────────────────────────────────────────────────────
    // 7. DUPLICADOS
    // ────────────────────────────────────────────────────────────────────
    console.log('\n🔎 BÚSQUEDA DE DUPLICADOS');
    console.log('─'.repeat(60));

    const duplicados = await Comprobante.findAll({
      attributes: [
        'serie',
        'correlativo',
        [sequelize.fn('COUNT', sequelize.col('id')), 'cantidad']
      ],
      group: ['serie', 'correlativo'],
      having: sequelize.where(sequelize.fn('COUNT', sequelize.col('id')), '>', 1),
      raw: true
    });

    if (duplicados.length === 0) {
      console.log('✅ No se encontraron comprobantes duplicados');
    } else {
      console.log(`⚠️  Se encontraron ${duplicados.length} comprobantes duplicados:`);
      duplicados.forEach(d => {
        console.log(`   ${d.serie}-${String(d.correlativo).padStart(8, '0')} aparece ${d.cantidad} veces`);
      });
    }

    console.log('\n' + '─'.repeat(60));
    console.log('✅ Verificación completada\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  verificarDatos();
}

module.exports = { verificarDatos };
