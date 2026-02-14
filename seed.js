/**
 * SEED — Datos iniciales del sistema
 *
 * Ejecutar UNA SOLA VEZ después de sincronizar la BD:
 *   node seed.js
 *
 * Usa findOrCreate para ser idempotente (se puede correr varias veces sin duplicar).
 */

require("dotenv").config();
const bcrypt = require("bcryptjs");
const sequelize = require("./src/database/database");

// Modelos
const { Login } = require("./src/models/login");
const Unidad = require("./src/models/facturacion/unidad");
const TipoAfectacion = require("./src/models/facturacion/tipoafectacion");
const TipoComprobante = require("./src/models/facturacion/tipocomprobante");
const TipoDocumento = require("./src/models/facturacion/tipodocumento");
const Moneda = require("./src/models/facturacion/moneda");
const Serie = require("./src/models/facturacion/serie");

async function seed() {
  try {
    await sequelize.authenticate();
    console.log("Conectado a la base de datos\n");

    // ─── 1. USUARIOS ────────────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash("123456", 10);
    const [userEber, createdEber] = await Login.findOrCreate({
      where: { usuario: "eber" },
      defaults: { usuario: "eber", password: hashedPassword, cargo: "Administrador" },
    });
    console.log(`${createdEber ? "✅ Creado" : "⏭️  Ya existe"} — Usuario: eber (Administrador)`);

    // ─── 2. UNIDADES DE MEDIDA (catálogo SUNAT) ──────────────────────────────
    const unidades = [
      { id: "NIU", descripcion: "Unidad" },
      { id: "ZZ",  descripcion: "Servicio" },
      { id: "KGM", descripcion: "Kilogramo" },
      { id: "GRM", descripcion: "Gramo" },
      { id: "MTR", descripcion: "Metro" },
      { id: "MTK", descripcion: "Metro Cuadrado" },
      { id: "MTQ", descripcion: "Metro Cúbico" },
      { id: "LTR", descripcion: "Litro" },
      { id: "MLT", descripcion: "Mililitro" },
      { id: "BX",  descripcion: "Caja" },
      { id: "PK",  descripcion: "Paquete" },
      { id: "RLL", descripcion: "Rollo" },
      { id: "SET", descripcion: "Juego / Conjunto" },
      { id: "BG",  descripcion: "Bolsa" },
      { id: "RM",  descripcion: "Resma" },
      { id: "CT",  descripcion: "Ciento" },
    ];
    for (const u of unidades) {
      const [, created] = await Unidad.findOrCreate({ where: { id: u.id }, defaults: u });
      console.log(`${created ? "✅ Creada" : "⏭️  Ya existe"} — Unidad: ${u.id} — ${u.descripcion}`);
    }

    // ─── 3. TIPOS DE AFECTACIÓN IGV (catálogo SUNAT 07) ─────────────────────
    const tiposAfectacion = [
      { id: "10", descripcion: "Gravado - Operación Onerosa",    letra: "O", codigo: "1001", nombre: "IGV", tipo: "IGV" },
      { id: "11", descripcion: "Gravado - Retiro por Premio",    letra: "O", codigo: "1002", nombre: "IGV", tipo: "IGV" },
      { id: "20", descripcion: "Exonerado - Operación Onerosa",  letra: "E", codigo: "9996", nombre: "EXO", tipo: "EXO" },
      { id: "30", descripcion: "Inafecto - Operación Onerosa",   letra: "I", codigo: "9998", nombre: "INA", tipo: "INA" },
      { id: "31", descripcion: "Inafecto - Retiro por Bonificación", letra: "I", codigo: "9999", nombre: "INA", tipo: "INA" },
      { id: "40", descripcion: "Exportación",                    letra: "G", codigo: "9997", nombre: "EXP", tipo: "EXP" },
    ];
    for (const t of tiposAfectacion) {
      const [, created] = await TipoAfectacion.findOrCreate({ where: { id: t.id }, defaults: t });
      console.log(`${created ? "✅ Creado" : "⏭️  Ya existe"} — TipoAfectacion: ${t.id} — ${t.descripcion}`);
    }

    // ─── 4. TIPOS DE COMPROBANTE ──────────────────────────────────────────────
    const tiposComprobante = [
      { id: "01", descripcion: "Factura" },
      { id: "03", descripcion: "Boleta de Venta" },
      { id: "07", descripcion: "Nota de Crédito" },
      { id: "08", descripcion: "Nota de Débito" },
      { id: "09", descripcion: "Guía de Remisión Remitente" },
      { id: "31", descripcion: "Guía de Remisión Transportista" },
    ];
    for (const tc of tiposComprobante) {
      const [, created] = await TipoComprobante.findOrCreate({ where: { id: tc.id }, defaults: tc });
      console.log(`${created ? "✅ Creado" : "⏭️  Ya existe"} — TipoComprobante: ${tc.id} — ${tc.descripcion}`);
    }

    // ─── 5. TIPOS DE DOCUMENTO DE IDENTIDAD (catálogo SUNAT 06) ─────────────
    const tiposDocumento = [
      { id: "0", descripcion: "Sin Documento" },
      { id: "1", descripcion: "DNI" },
      { id: "4", descripcion: "Carnet de Extranjería" },
      { id: "6", descripcion: "RUC" },
      { id: "7", descripcion: "Pasaporte" },
      { id: "A", descripcion: "Cédula Diplomática de Identidad" },
    ];
    for (const td of tiposDocumento) {
      const [, created] = await TipoDocumento.findOrCreate({ where: { id: td.id }, defaults: td });
      console.log(`${created ? "✅ Creado" : "⏭️  Ya existe"} — TipoDocumento: ${td.id} — ${td.descripcion}`);
    }

    // ─── 6. MONEDAS ──────────────────────────────────────────────────────────
    const monedas = [
      { id: "PEN", descripcion: "Sol Peruano" },
      { id: "USD", descripcion: "Dólar Americano" },
    ];
    for (const m of monedas) {
      const [, created] = await Moneda.findOrCreate({ where: { id: m.id }, defaults: m });
      console.log(`${created ? "✅ Creada" : "⏭️  Ya existe"} — Moneda: ${m.id} — ${m.descripcion}`);
    }

    // ─── 7. SERIES INICIALES ─────────────────────────────────────────────────
    const series = [
      { tipo_comprobante_id: "01", serie: "F001", correlativo: 1 },
      { tipo_comprobante_id: "03", serie: "B001", correlativo: 1 },
      { tipo_comprobante_id: "07", serie: "FC01", correlativo: 1 },
      { tipo_comprobante_id: "08", serie: "FD01", correlativo: 1 },
    ];
    for (const s of series) {
      const [, created] = await Serie.findOrCreate({
        where: { tipo_comprobante_id: s.tipo_comprobante_id, serie: s.serie },
        defaults: s,
      });
      console.log(`${created ? "✅ Creada" : "⏭️  Ya existe"} — Serie: ${s.serie} (${s.tipo_comprobante_id})`);
    }

    console.log("\n🌱 Seed completado correctamente.");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error en seed:", error.message);
    process.exit(1);
  }
}

seed();
