/**
 * 0001 — Formatos iniciales (antes se insertaban en main.js al arrancar).
 * Idempotente: no duplica ni modifica formatos que ya existan.
 */
const FORMATOS = [
  ["ticket", "Ticket"],
  ["boleta", "Boleta de Venta"],
  ["factura", "Factura"],
  ["guiarem", "Guia de Remision"],
  ["guiatransp", "Guia Transportista"],
  ["notacredito", "Nota de Credito"],
  ["ingresos", "Ingresos y Egresos"],
  ["cotizacion", "Cotizacion"],
];

async function up({ context: { sequelize } }) {
  const valores = FORMATOS.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2}, NOW(), NOW())`).join(", ");
  await sequelize.query(
    `INSERT INTO formatos (key, nombre, "createdAt", "updatedAt") VALUES ${valores}
     ON CONFLICT (key) DO NOTHING`,
    { bind: FORMATOS.flat() }
  );
}

async function down() {
  // No se borran: usuario_formatos puede referenciarlos.
}

module.exports = { up, down };
