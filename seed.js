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
const sequelize = require("./src/infrastructure/database/database");

// Modelos
const { Login } = require("./src/infrastructure/database/models/login");
const Unidad = require("./src/infrastructure/database/models/facturacion/unidad");
const TipoAfectacion = require("./src/infrastructure/database/models/facturacion/tipoafectacion");
const TipoComprobante = require("./src/infrastructure/database/models/facturacion/tipocomprobante");
const TipoDocumento = require("./src/infrastructure/database/models/facturacion/tipodocumento");
const Moneda = require("./src/infrastructure/database/models/facturacion/moneda");
const Serie = require("./src/infrastructure/database/models/facturacion/serie");
const Emisor = require("./src/infrastructure/database/models/facturacion/emisor");

async function seed() {
  try {
    await sequelize.authenticate();
    console.log("Conectado a la base de datos\n");

    // ─── 1. USUARIOS ────────────────────────────────────────────────────────
    // La contraseña inicial del admin llega por entorno: nunca un valor por
    // defecto versionado en el repo.
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    if (!adminPassword || adminPassword.length < 10) {
      throw new Error("Defina SEED_ADMIN_PASSWORD (mínimo 10 caracteres) para crear el usuario administrador");
    }
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    const [userEber, createdEber] = await Login.findOrCreate({
      where: { usuario: "eber" },
      defaults: { usuario: "eber", password: hashedPassword, cargo: "Administrador" },
    });
    console.log(`${createdEber ? "✅ Creado" : "⏭️  Ya existe"} — Usuario: eber (Administrador)`);

    // ─── 2. UNIDADES DE MEDIDA (catálogo SUNAT) ──────────────────────────────
    const unidades = [
      { id: "4A",  descripcion: "Bobinas" },
      { id: "BJ",  descripcion: "Balde" },
      { id: "BLL", descripcion: "Barriles" },
      { id: "BG",  descripcion: "Bolsa" },
      { id: "BO",  descripcion: "Botellas" },
      { id: "BX",  descripcion: "Caja" },
      { id: "CT",  descripcion: "Cartones" },
      { id: "CMK", descripcion: "Centimetro Cuadrado" },
      { id: "CMQ", descripcion: "Centimetro Cubico" },
      { id: "CMT", descripcion: "Centimetro Lineal" },
      { id: "CEN", descripcion: "Ciento de Unidades" },
      { id: "CY",  descripcion: "Cilindro" },
      { id: "CJ",  descripcion: "Conos" },
      { id: "DZN", descripcion: "Docena" },
      { id: "DZP", descripcion: "Docena por 10**6" },
      { id: "BE",  descripcion: "Fardo" },
      { id: "GLI", descripcion: "Galon Ingles (4,545956L)" },
      { id: "GRM", descripcion: "Gramo" },
      { id: "GRO", descripcion: "Gruesa" },
      { id: "HLT", descripcion: "Hectolitro" },
      { id: "LEF", descripcion: "Hoja" },
      { id: "SET", descripcion: "Juego" },
      { id: "KGM", descripcion: "Kilogramo" },
      { id: "KTM", descripcion: "Kilometro" },
      { id: "KWH", descripcion: "Kilovatio Hora" },
      { id: "KT",  descripcion: "Kit" },
      { id: "CA",  descripcion: "Latas" },
      { id: "LBR", descripcion: "Libras" },
      { id: "LTR", descripcion: "Litro" },
      { id: "MWH", descripcion: "Megawatt Hora" },
      { id: "MTR", descripcion: "Metro" },
      { id: "MTK", descripcion: "Metro Cuadrado" },
      { id: "MTQ", descripcion: "Metro Cubico" },
      { id: "MGM", descripcion: "Miligramos" },
      { id: "MLT", descripcion: "Mililitro" },
      { id: "MMT", descripcion: "Milimetro" },
      { id: "MMK", descripcion: "Milimetro Cuadrado" },
      { id: "MMQ", descripcion: "Milimetro Cubico" },
      { id: "MLL", descripcion: "Millares" },
      { id: "UM",  descripcion: "Millon de Unidades" },
      { id: "ONZ", descripcion: "Onzas" },
      { id: "PF",  descripcion: "Paletas" },
      { id: "PK",  descripcion: "Paquete" },
      { id: "PR",  descripcion: "Par" },
      { id: "FOT", descripcion: "Pies" },
      { id: "FTK", descripcion: "Pies Cuadrados" },
      { id: "FTQ", descripcion: "Pies Cubicos" },
      { id: "C62", descripcion: "Piezas" },
      { id: "PG",  descripcion: "Placas" },
      { id: "ST",  descripcion: "Pliego" },
      { id: "INH", descripcion: "Pulgadas" },
      { id: "RM",  descripcion: "Resma" },
      { id: "DR",  descripcion: "Tambor" },
      { id: "STN", descripcion: "Tonelada Corta" },
      { id: "LTN", descripcion: "Tonelada Larga" },
      { id: "TNE", descripcion: "Toneladas" },
      { id: "TU",  descripcion: "Tubos" },
      { id: "NIU", descripcion: "Unidad (Bienes)" },
      { id: "ZZ",  descripcion: "Unidad (Servicios)" },
      { id: "GLL", descripcion: "US Galon (3,7843 L)" },
      { id: "YRD", descripcion: "Yarda" },
      { id: "YDK", descripcion: "Yarda Cuadrada" },
      { id: "RLL", descripcion: "Rollo" },
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

    // ─── 8. EMISOR DE PRUEBA (entorno beta SUNAT) ─────────────────────────
    const [, createdEmisor] = await Emisor.findOrCreate({
      where: { ruc: "20000000001" },
      defaults: {
        tipodoc: "6",
        ruc: "20000000001",
        razon_social: "EMPRESA DE PRUEBA SAC",
        nombre_comercial: "IMPRENTA ALEXANDER",
        usuario_sol: "MODDATOS",
        clave_sol: "MODDATOS",
        direccion: "AV. PRUEBA 123",
        ubigeo: "150101",
        pais: "PE",
        departamento: "LIMA",
        provincia: "LIMA",
        distrito: "LIMA",
      },
    });
    console.log(`${createdEmisor ? "✅ Creado" : "⏭️  Ya existe"} — Emisor: 20000000001 (EMPRESA DE PRUEBA SAC)`);

    console.log("\n🌱 Seed completado correctamente.");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error en seed:", error.message);
    process.exit(1);
  }
}

seed();
