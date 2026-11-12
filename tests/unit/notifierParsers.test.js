const { PARSERS } = require("../../src/application/services/notifier/parsers");
const { normalizarMonto } = require("../../src/application/services/notifier/parsers/comun");
const { celdaCsv, enmascararNombre, normalizarTexto } = require("../../src/application/services/notifier/texto");
const { hoyEnLima, rangoDiaLima } = require("../../src/application/services/notifier/horaLima");

// Muestras reales de las notificaciones (nombres ficticios), las mismas del proyecto Pagos Notifier.
const casos = {
  YAPE: require("./fixtures/notifier/yape.json"),
  PLIN: require("./fixtures/notifier/plin.json"),
};

describe.each(Object.keys(casos))("parser %s", (proveedor) => {
  const { positive, negative } = casos[proveedor];
  const parse = PARSERS[proveedor];

  test("tiene al menos 3 positivos y 2 negativos", () => {
    expect(positive.length).toBeGreaterThanOrEqual(3);
    expect(negative.length).toBeGreaterThanOrEqual(2);
  });

  test.each(positive.map((c) => [c.name, c]))("acepta: %s", (_n, c) => {
    expect(parse(c.input)).toEqual({ kind: "payment", ...c.expected });
  });

  test.each(negative.map((c) => [c.name, c]))("rechaza: %s", (_n, c) => {
    const r = parse(c.input);
    expect(r.kind).toBe(c.expected.kind);
    if (c.expected.reason) expect(r).toMatchObject({ reason: c.expected.reason });
  });
});

describe("utilidades de pagos", () => {
  test("los montos son strings con 2 decimales y nunca cero", () => {
    expect(normalizarMonto("1,250.5")).toBe("1250.50");
    expect(normalizarMonto("20")).toBe("20.00");
    expect(normalizarMonto("0")).toBeNull();
    expect(normalizarMonto("1.234")).toBeNull();
  });
  test("el texto se normaliza: sin control, bidi ni espacios duros", () => {
    expect(normalizarTexto("  Ana ‮Perez\u0007  ")).toBe("Ana Perez");
  });
  test("los nombres se enmascaran para los logs", () => {
    expect(enmascararNombre("MARIA QUISPE")).toBe("M*** Q***");
  });
  test("el CSV neutraliza fórmulas", () => {
    expect(celdaCsv("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(celdaCsv("-5")).toBe(`"'-5"`);
    expect(celdaCsv("Ana")).toBe("Ana");
  });
  test("el día de Lima va de 05:00 UTC a 05:00 UTC", () => {
    expect(hoyEnLima(new Date("2026-11-12T04:59:00Z"))).toBe("2026-11-11");
    const { desde, hasta } = rangoDiaLima("2026-11-12");
    expect(desde.toISOString()).toBe("2026-11-12T05:00:00.000Z");
    expect(hasta.toISOString()).toBe("2026-11-13T05:00:00.000Z");
  });
});
