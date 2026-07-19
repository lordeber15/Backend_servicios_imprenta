"use strict";

// Códigos SUNAT que no tienen sentido reintentar ni regenerando el XML
// (la numeración ya está registrada en SUNAT o el comprobante fue dado de baja).
const CODIGOS_TERMINAL = new Set([
  "1034", // Numeración ya registrada
  "0111", // Comprobante dado de baja
  "2108", // Tipo de cambio no válido
  "3101", // Importe de tributo inválido
]);

module.exports = { CODIGOS_TERMINAL };
