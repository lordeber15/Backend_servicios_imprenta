const { calcularLinea, calcularTotales } = require("../../src/application/services/calculoComprobante");

describe("cálculo de montos (precio con IGV manda)", () => {
  test("100 tarjetas a S/ 0.15 → 15.00 = 12.71 + 2.29", () => {
    const l = calcularLinea({ cantidad: 100, precio_unitario: 0.15 });
    expect(l).toMatchObject({ importe_total: 15, valor_total: 12.71, igv: 2.29 });
  });

  test("el IGV es el de la LÍNEA, no el de una unidad", () => {
    const l = calcularLinea({ cantidad: 3, precio_unitario: 59.9 });
    expect(l.importe_total).toBe(179.7);
    expect(l.igv).toBe(27.41);
    expect(Math.round((l.valor_total + l.igv) * 100)).toBe(17970);
  });

  test("los totales cuadran exactamente con la suma de líneas (sin errores de coma flotante)", () => {
    const lineas = [0.1, 0.2, 0.3, 19.99, 7.77].map((p) => calcularLinea({ cantidad: 7, precio_unitario: p }));
    const t = calcularTotales(lineas);
    const suma = lineas.reduce((s, l) => s + Math.round(l.importe_total * 100), 0) / 100;
    expect(t.total).toBe(suma);
    expect(Math.round((t.op_gravadas + t.igv) * 100)).toBe(Math.round(t.total * 100));
  });

  test.each([[1, 1.18, 1, 0.18], [2, 0.5, 0.85, 0.15], [1, 700, 593.22, 106.78]])(
    "%s × %s → valor %s + igv %s",
    (cantidad, precio, valor, igv) => {
      expect(calcularLinea({ cantidad, precio_unitario: precio })).toMatchObject({ valor_total: valor, igv });
    }
  );
});
