#!/usr/bin/env node
/**
 * IMPORTADOR DE COMPROBANTES DESDE XML
 *
 * Lee los archivos XML de comprobantes electrónicos (UBL 2.1)
 * y los importa a la base de datos, incluyendo:
 * - Series (si no existen)
 * - Clientes (si no existen)
 * - Comprobantes (cabecera)
 * - Detalles (items del comprobante)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const sequelize = require('./src/infrastructure/database/database');

// Modelos
const Comprobante = require('./src/infrastructure/database/models/facturacion/comprobante');
const Detalle = require('./src/infrastructure/database/models/facturacion/detalles');
const Serie = require('./src/infrastructure/database/models/facturacion/serie');
const Cliente = require('./src/infrastructure/database/models/facturacion/cliente');

const XML_DIR = path.join(__dirname, 'storage', 'xml');

// Mapeo de tipos de documento SUNAT
const TIPO_DOC_MAP = {
  '1': '1', // DNI
  '6': '6', // RUC
  '4': '4', // Carnet de extranjería
  '7': '7', // Pasaporte
  '0': '0', // Sin documento
};

// Mapeo de tipos de comprobante
const TIPO_COMPROBANTE_MAP = {
  '01': '01', // Factura
  '03': '03', // Boleta
  '07': '07', // Nota de Crédito
  '08': '08', // Nota de Débito
  '09': '09', // Guía de Remisión
  '31': '31', // Guía de Remisión - Transportista
};

/**
 * Parsear XML a JSON
 */
async function parseXML(xmlContent) {
  const parser = new xml2js.Parser({
    explicitArray: false,
    ignoreAttrs: false,
    tagNameProcessors: [xml2js.processors.stripPrefix] // Elimina prefijos cac:, cbc:
  });

  return parser.parseStringPromise(xmlContent);
}

/**
 * Extraer valor de un campo XML (maneja CDATA y texto simple)
 */
function extractValue(field) {
  if (!field) return null;
  if (typeof field === 'string') return field.trim();
  if (field._) return field._.trim();
  return null;
}

/**
 * Extraer número con decimales
 */
function extractDecimal(field) {
  const value = extractValue(field);
  return value ? parseFloat(value) : 0;
}

/**
 * Extraer fecha en formato YYYY-MM-DD
 */
function extractDate(field) {
  const value = extractValue(field);
  if (!value) return null;

  // Si ya está en formato ISO: 2026-02-22
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(value);
  }

  return new Date(value);
}

/**
 * Parsear nombre de archivo XML: RUC-TIPO-SERIE-CORRELATIVO.xml
 * Ejemplo: 20608582011-01-F001-00000011.xml
 */
function parseFilename(filename) {
  const match = filename.match(/^(\d+)-(\d+)-([A-Z0-9]+)-(\d+)\.xml$/i);

  if (!match) {
    console.warn(`⚠️  Formato de archivo inválido: ${filename}`);
    return null;
  }

  return {
    ruc: match[1],
    tipoComprobante: match[2],
    serie: match[3],
    correlativo: parseInt(match[4], 10),
    nombreXml: filename.replace('.xml', '')
  };
}

/**
 * Buscar o crear cliente
 */
async function findOrCreateCliente(tipoDocId, nrodoc, razonSocial, direccion = null) {
  let cliente = await Cliente.findOne({
    where: { tipo_documento_id: tipoDocId, nrodoc }
  });

  if (!cliente) {
    cliente = await Cliente.create({
      tipo_documento_id: tipoDocId,
      nrodoc,
      razon_social: razonSocial || 'CLIENTE GENERICO',
      direccion: direccion || '-'
    });
    console.log(`   ✅ Cliente creado: ${nrodoc} - ${razonSocial}`);
  }

  return cliente;
}

/**
 * Buscar o crear serie
 */
async function findOrCreateSerie(tipoComprobanteId, serie, correlativo) {
  let serieRecord = await Serie.findOne({
    where: { tipo_comprobante_id: tipoComprobanteId, serie }
  });

  if (!serieRecord) {
    serieRecord = await Serie.create({
      tipo_comprobante_id: tipoComprobanteId,
      serie,
      correlativo
    });
    console.log(`   ✅ Serie creada: ${tipoComprobanteId}-${serie} (correlativo: ${correlativo})`);
  } else {
    // Actualizar correlativo si es mayor
    if (correlativo > serieRecord.correlativo) {
      await serieRecord.update({ correlativo });
      console.log(`   📝 Serie actualizada: ${serie} -> correlativo ${correlativo}`);
    }
  }

  return serieRecord;
}

/**
 * Procesar un archivo XML y extraer datos del comprobante
 */
async function processXmlFile(filePath) {
  const filename = path.basename(filePath);
  console.log(`\n📄 Procesando: ${filename}`);

  // Parsear nombre de archivo
  const fileInfo = parseFilename(filename);
  if (!fileInfo) return null;

  // Leer y parsear XML
  const xmlContent = fs.readFileSync(filePath, 'utf-8');
  const json = await parseXML(xmlContent);

  // Detectar tipo de documento raíz (Invoice, CreditNote, DebitNote, etc.)
  const docType = Object.keys(json)[0];
  const doc = json[docType];

  // ─────────────────────────────────────────────────────────────────────────
  // EXTRAER DATOS DEL XML
  // ─────────────────────────────────────────────────────────────────────────

  // Serie y correlativo
  const serieCompleta = extractValue(doc.ID); // Ej: F001-00000011
  const [serie, correlativoStr] = serieCompleta.split('-');
  const correlativo = parseInt(correlativoStr, 10);

  // Fechas
  const fechaEmision = extractDate(doc.IssueDate);

  // Moneda
  const moneda = doc.DocumentCurrencyCode?.$
    ? extractValue(doc.DocumentCurrencyCode)
    : 'PEN';

  // Cliente
  const customerParty = doc.AccountingCustomerParty?.Party;
  const clienteTipoDoc = customerParty?.PartyIdentification?.ID?.$
    ? customerParty.PartyIdentification.ID.$.schemeID
    : '1';
  const clienteNroDoc = extractValue(customerParty?.PartyIdentification?.ID);
  const clienteRazonSocial = extractValue(
    customerParty?.PartyLegalEntity?.RegistrationName
  );

  // Forma de pago
  const formaPago = extractValue(doc.PaymentTerms?.PaymentMeansID) || 'Contado';

  // Totales
  const legalMonetary = doc.LegalMonetaryTotal;
  const opGravadas = extractDecimal(legalMonetary?.TaxExclusiveAmount);
  const igv = extractDecimal(doc.TaxTotal?.TaxAmount);
  const total = extractDecimal(legalMonetary?.PayableAmount);

  // Items/Detalles (pueden ser array o objeto único)
  let invoiceLines = doc.InvoiceLine || doc.CreditNoteLine || doc.DebitNoteLine || [];
  if (!Array.isArray(invoiceLines)) {
    invoiceLines = [invoiceLines];
  }

  const detalles = invoiceLines.map((line, index) => {
    const itemId = extractValue(line.ID);
    const cantidad = extractDecimal(line.InvoicedQuantity || line.CreditedQuantity || line.DebitedQuantity);
    const descripcion = extractValue(line.Item?.Description);
    const precioUnitario = extractDecimal(
      line.PricingReference?.AlternativeConditionPrice?.PriceAmount
    );
    const valorUnitario = extractDecimal(line.Price?.PriceAmount);
    const valorTotal = extractDecimal(line.LineExtensionAmount);
    const igvItem = extractDecimal(line.TaxTotal?.TaxAmount);
    const importeTotal = precioUnitario * cantidad;

    return {
      item: parseInt(itemId) || (index + 1),
      descripcion,
      unidad_id: 'NIU', // Por defecto
      cantidad,
      valor_unitario: valorUnitario,
      precio_unitario: precioUnitario,
      igv: igvItem,
      porcentaje_igv: 18,
      valor_total: valorTotal,
      importe_total: importeTotal
    };
  });

  return {
    // Datos del archivo
    nombreXml: fileInfo.nombreXml,

    // Cabecera
    tipo_comprobante_id: fileInfo.tipoComprobante,
    serie,
    correlativo,
    fecha_emision: fechaEmision,
    moneda_id: moneda,
    forma_pago: formaPago,

    // Cliente
    cliente: {
      tipo_documento_id: TIPO_DOC_MAP[clienteTipoDoc] || '1',
      nrodoc: clienteNroDoc,
      razon_social: clienteRazonSocial
    },

    // Totales
    op_gravadas: opGravadas,
    op_exoneradas: 0,
    op_inafectas: 0,
    igv,
    total,

    // Detalles
    detalles
  };
}

/**
 * Importar comprobante a la base de datos
 */
async function importComprobante(data) {
  // 1. Verificar si ya existe
  const existente = await Comprobante.findOne({
    where: {
      serie: data.serie,
      correlativo: data.correlativo,
      tipo_comprobante_id: data.tipo_comprobante_id
    }
  });

  if (existente) {
    console.log(`   ⏭️  Ya existe: ${data.serie}-${String(data.correlativo).padStart(8, '0')}`);
    return { skipped: true };
  }

  // 2. Crear/buscar cliente
  const cliente = await findOrCreateCliente(
    data.cliente.tipo_documento_id,
    data.cliente.nrodoc,
    data.cliente.razon_social
  );

  // 3. Crear/buscar serie
  const serie = await findOrCreateSerie(
    data.tipo_comprobante_id,
    data.serie,
    data.correlativo
  );

  // 4. Crear comprobante
  const comprobante = await Comprobante.create({
    emisor_id: 1, // Asume que existe un emisor con ID 1
    tipo_comprobante_id: data.tipo_comprobante_id,
    serie_id: serie.id,
    serie: data.serie,
    correlativo: data.correlativo,
    forma_pago: data.forma_pago,
    fecha_emision: data.fecha_emision,
    moneda_id: data.moneda_id,
    op_gravadas: data.op_gravadas,
    op_exoneradas: data.op_exoneradas,
    op_inafectas: data.op_inafectas,
    igv: data.igv,
    total: data.total,
    cliente_id: cliente.id,
    estado_sunat: 'AC', // Asumimos que está aceptado si ya tiene XML
    nombre_xml: data.nombreXml
  });

  console.log(`   ✅ Comprobante creado: ${data.serie}-${String(data.correlativo).padStart(8, '0')} | Total: S/ ${data.total}`);

  // 5. Crear detalles
  for (const detalle of data.detalles) {
    await Detalle.create({
      comprobante_id: comprobante.id,
      ...detalle
    });
  }

  console.log(`   ✅ ${data.detalles.length} detalle(s) insertado(s)`);

  return { created: true, comprobante };
}

/**
 * FUNCIÓN PRINCIPAL
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     IMPORTADOR DE COMPROBANTES DESDE XML (UBL 2.1)       ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Conectar a la base de datos
    console.log('🔌 Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('✅ Conexión establecida\n');

    // Verificar que existe el directorio de XML
    if (!fs.existsSync(XML_DIR)) {
      console.error(`❌ Directorio no encontrado: ${XML_DIR}`);
      process.exit(1);
    }

    // Listar archivos XML
    const files = fs.readdirSync(XML_DIR).filter(f => f.endsWith('.xml'));

    if (files.length === 0) {
      console.log('⚠️  No se encontraron archivos XML');
      process.exit(0);
    }

    console.log(`📋 Archivos encontrados: ${files.length}\n`);

    // Estadísticas
    let creados = 0;
    let omitidos = 0;
    let errores = 0;

    // Procesar cada archivo
    for (const file of files) {
      try {
        const filePath = path.join(XML_DIR, file);
        const data = await processXmlFile(filePath);

        if (!data) {
          omitidos++;
          continue;
        }

        const result = await importComprobante(data);

        if (result.skipped) {
          omitidos++;
        } else if (result.created) {
          creados++;
        }

      } catch (error) {
        console.error(`   ❌ Error procesando ${file}:`);
        console.error(`      ${error.message}`);
        errores++;
      }
    }

    // Resumen final
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                       RESUMEN                             ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log(`✅ Comprobantes creados:  ${creados}`);
    console.log(`⏭️  Comprobantes omitidos: ${omitidos} (ya existían)`);
    console.log(`❌ Errores:               ${errores}`);
    console.log(`📊 Total procesados:      ${files.length}\n`);

  } catch (error) {
    console.error('\n❌ Error fatal:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('🔌 Conexión cerrada');
  }
}

// Verificar dependencias
try {
  require('xml2js');
} catch (e) {
  console.error('❌ Dependencia faltante: xml2js');
  console.error('   Instala con: npm install xml2js');
  process.exit(1);
}

// Ejecutar
if (require.main === module) {
  main();
}

module.exports = { processXmlFile, importComprobante };
