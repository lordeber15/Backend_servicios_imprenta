/**
 * Constantes de negocio compartidas (validación, caja y migración 0003).
 */

// Métodos de pago aceptados. La BD los restringe con un CHECK (migración 0003).
const METODOS_PAGO = ["Efectivo", "Yape", "Plin", "Tarjeta", "Transferencia"];

module.exports = { METODOS_PAGO };
