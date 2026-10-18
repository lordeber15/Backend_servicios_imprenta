const p = require("../../src/application/plazosSunat");

describe("plazos SUNAT (días calendario, Lima)", () => {
  test("factura: hasta D+3 inclusive", () => {
    expect(p.vencido("2026-01-10", "01", "F001", "2026-01-13")).toBe(false);
    expect(p.vencido("2026-01-10", "01", "F001", "2026-01-14")).toBe(true);
  });
  test("boleta: hasta D+5 inclusive", () => {
    expect(p.vencido("2026-01-10", "03", "B001", "2026-01-15")).toBe(false);
    expect(p.vencido("2026-01-10", "03", "B001", "2026-01-16")).toBe(true);
  });
  test("una NC sigue el plazo del comprobante que modifica (por la letra de la serie)", () => {
    expect(p.plazoDias("07", "BC01")).toBe(5);
    expect(p.plazoDias("07", "FC01")).toBe(3);
  });
  test("cruza fin de mes y año", () => {
    expect(p.fechaLimite("2026-12-30", "01", "F001")).toBe("2027-01-02");
    expect(p.fechaLimite("2028-02-27", "03", "B001")).toBe("2028-03-03"); // 2028 es bisiesto
  });
  test("acepta la fecha guardada a medianoche UTC", () => {
    expect(p.fechaLimite(new Date("2026-01-10T00:00:00Z"), "01", "F001")).toBe("2026-01-13");
  });
  test("días restantes: 0 = vence hoy, negativo = vencido", () => {
    expect(p.diasRestantes("2026-01-10", "01", "F001", "2026-01-13")).toBe(0);
    expect(p.diasRestantes("2026-01-10", "01", "F001", "2026-01-15")).toBe(-2);
  });
});
