const { DOMParser } = require("@xmldom/xmldom");
const boleta = require("../../src/infrastructure/external_services/sunat/xmlBuilders/boletaBuilder");
const factura = require("../../src/infrastructure/external_services/sunat/xmlBuilders/facturaBuilder");
const guia = require("../../src/infrastructure/external_services/sunat/xmlBuilders/guiaRemisionBuilder");
const { cdata, esc } = require("../../src/infrastructure/external_services/sunat/xmlBuilders/xmlTexto");
const { calcularLinea, calcularTotales } = require("../../src/application/services/calculoComprobante");

/** Parsea y falla ante cualquier error de XML (el DOMParser por defecto solo avisa). */
function parsear(xml) {
  const errores = [];
  const doc = new DOMParser({
    onError: (nivel, msg) => { if (nivel !== "warning") errores.push(msg); },
  }).parseFromString(xml, "text/xml");
  if (errores.length) throw new Error(`XML inválido: ${errores.join("; ")}`);
  return doc;
}
const textos = (doc, tag) => Array.from(doc.getElementsByTagNameNS("*", tag)).map((n) => n.textContent);

const EMISOR = {
  id: 1, ruc: "20000000001", razon_social: "IMPRENTA DE PRUEBA S.A.C.", nombre_comercial: "IMPRENTA",
  direccion: "Av. Siempre Viva 123", ubigeo: "150101", departamento: "LIMA", provincia: "LIMA", distrito: "LIMA", pais: "PE",
};
function comprobante(items, extra = {}) {
  const lineas = items.map(calcularLinea);
  return {
    tipo_comprobante_id: "03", serie: "B001", correlativo: 42, fecha_emision: "2026-01-10T00:00:00.000Z",
    moneda_id: "PEN", forma_pago: "Contado", ...calcularTotales(lineas),
    Emisor: EMISOR, Cliente: null,
    Detalles: lineas.map((l, i) => ({ ...l, descripcion: items[i].descripcion, unidad_id: "NIU" })),
    ...extra,
  };
}

describe("XML UBL de boleta/factura", () => {
  const c = comprobante([
    { descripcion: "Tarjetas de presentación", cantidad: 100, precio_unitario: 0.15 },
    { descripcion: "Diseño", cantidad: 1, precio_unitario: 50 },
  ]);
  const xml = boleta.build(c);

  test("bien formado y con el tipo 03", () => {
    const doc = parsear(xml);
    expect(textos(doc, "InvoiceTypeCode")).toEqual(["03"]);
    expect(textos(doc, "ID")).toContain("B001-00000042");
  });

  test("el IGV declarado por línea es el de la línea y suma el global", () => {
    const doc = parsear(xml);
    const lineas = Array.from(doc.getElementsByTagNameNS("*", "InvoiceLine"));
    const igvLineas = lineas.map((l) => Number(l.getElementsByTagNameNS("*", "TaxAmount").item(0).textContent));
    expect(igvLineas).toEqual([2.29, 7.63]);
    const global = doc.getElementsByTagNameNS("*", "TaxTotal").item(doc.getElementsByTagNameNS("*", "TaxTotal").length - 1);
    expect(Number(textos(doc, "PayableAmount")[0])).toBe(65);
    expect(igvLineas.reduce((a, b) => a + b, 0)).toBeCloseTo(c.igv, 2);
    expect(global).toBeTruthy();
  });

  test("snapshot: cualquier cambio en la estructura del XML se revisa a propósito", () => {
    expect(xml).toMatchSnapshot();
  });
});

describe("texto del usuario dentro del XML", () => {
  const malicioso = 'Libro ]]></cbc:Description><cbc:Note>INYECTADO</cbc:Note><cbc:Description><![CDATA[ & <b>"';

  test("una descripción con ]]> no rompe ni altera el XML", () => {
    const doc = parsear(factura.build(comprobante([{ descripcion: malicioso, cantidad: 1, precio_unitario: 10 }], {
      tipo_comprobante_id: "01", serie: "F001",
      Cliente: { tipo_documento_id: "6", nrodoc: "20123456789", razon_social: 'ACME ]]> & "SAC"' },
    })));
    expect(textos(doc, "Note")).not.toContain("INYECTADO");
    expect(textos(doc, "Description")).toContain(malicioso);
    expect(textos(doc, "RegistrationName")).toContain('ACME ]]> & "SAC"');
  });

  test("una nota de crédito sin producto conserva la descripción de la línea", () => {
    const nc = comprobante([{ descripcion: "Devolución de 10 tarjetas", cantidad: 1, precio_unitario: 1.5 }], {
      tipo_comprobante_id: "07", serie: "BC01", tipo_nota_id: "07", descripcion_nota: "Devolución",
      comprobanteRef: { serie: "B001", correlativo: 41, tipo_comprobante_id: "03" },
    });
    expect(textos(parsear(factura.buildNota(nc)), "Description")).toContain("Devolución de 10 tarjetas");
  });

  test("guía: placa, licencia y demás campos libres quedan escapados", () => {
    const xml = guia.build({
      tipo_guia: "09", serie: "T001", correlativo: 1, fecha_emision: "2026-01-10", fecha_traslado: "2026-01-10",
      motivo_traslado_id: "01", descripcion_motivo: "Venta ]]><x/>", peso_bruto_total: 5, unidad_peso_id: "KGM",
      modalidad_traslado: "02", vehiculo_placa: 'ABC<1>"', conductor_nrodoc: "12345678", conductor_tipo_doc: "1",
      conductor_nombres: "Juan", conductor_licencia: "Q1<script>", ubigeo_partida: "150101", direccion_partida: "Av. A & B",
      ubigeo_llegada: "150102", direccion_llegada: "Jr. C", numero_contenedor: "C<1>",
      Emisor: EMISOR, Destinatario: { tipo_documento_id: "6", nrodoc: "20123456789", razon_social: "CLI" },
      DetalleGuias: [{ descripcion: "Cajas <b>", cantidad: 2, unidad_id: "NIU", numero_serie: "S<1>" }],
    });
    const doc = parsear(xml);
    expect(textos(doc, "LicensePlateID")).toEqual(['ABC<1>"']);
    expect(textos(doc, "JobTitle")).toEqual(["Q1<script>"]);
    expect(doc.getElementsByTagName("x").length).toBe(0);
    expect(doc.getElementsByTagName("script").length).toBe(0);
  });

  test("cdata y esc", () => {
    expect(cdata("a]]>b")).toBe("<![CDATA[a]]]]><![CDATA[>b]]>");
    expect(cdata("x\u0001y")).toBe("<![CDATA[xy]]>");
    expect(esc(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&apos;");
    expect(esc(null)).toBe("");
  });
});
