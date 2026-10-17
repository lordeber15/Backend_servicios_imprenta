/**
 * CÁLCULO DE MONTOS DE UN COMPROBANTE (operaciones gravadas, IGV 18 %)
 *
 * Única fuente de verdad: el servidor ignora los montos que envíe el cliente
 * y los recalcula aquí a partir de cantidad y precio unitario CON IGV.
 *
 * Criterio: lo que paga el cliente (importe_total = cantidad × precio) manda.
 *   valor_total = importe_total / 1.18   (redondeado a 2 decimales)
 *   igv         = importe_total − valor_total
 * Así la suma de las líneas cuadra exactamente con el total cobrado, y el IGV
 * de cada línea es el de la LÍNEA (antes se guardaba el de una unidad y el XML
 * declaraba un IGV de línea incorrecto cuando la cantidad era > 1).
 *
 * Todo se calcula en céntimos enteros para evitar errores de coma flotante.
 */

const IGV_PORCENTAJE = 18;
const FACTOR_IGV = 1 + IGV_PORCENTAJE / 100;

const aCentimos = (n) => Math.round(Number(n) * 100);
const deCentimos = (c) => c / 100;
const a6 = (n) => Math.round(Number(n) * 1e6) / 1e6;

/**
 * @param {{cantidad: number, precio_unitario: number}} item  precio_unitario incluye IGV
 */
function calcularLinea({ cantidad, precio_unitario }) {
  const importeC = Math.round(Number(cantidad) * Number(precio_unitario) * 100);
  const valorC = Math.round(importeC / FACTOR_IGV);
  const igvC = importeC - valorC;

  return {
    cantidad: a6(cantidad),
    precio_unitario: a6(precio_unitario),
    valor_unitario: a6(Number(precio_unitario) / FACTOR_IGV),
    porcentaje_igv: IGV_PORCENTAJE,
    valor_total: deCentimos(valorC),
    igv: deCentimos(igvC),
    importe_total: deCentimos(importeC),
  };
}

/** Totales de cabecera a partir de líneas ya calculadas. */
function calcularTotales(lineas) {
  const suma = (campo) => deCentimos(lineas.reduce((s, l) => s + aCentimos(l[campo]), 0));
  return {
    op_gravadas: suma("valor_total"),
    op_exoneradas: 0,
    op_inafectas: 0,
    igv: suma("igv"),
    total: suma("importe_total"),
  };
}

module.exports = { IGV_PORCENTAJE, calcularLinea, calcularTotales };
