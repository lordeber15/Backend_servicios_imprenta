const AdmZip = require("adm-zip");
const { parseCdr, resolverEstadoCdr } = require("../../src/infrastructure/external_services/sunat/cdrParser");

/** CDR como lo devuelve SUNAT: ZIP con una carpeta "dummy/" y el R-*.xml, en base64. */
function cdr(codigo, notas = []) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ar:ApplicationResponse xmlns:ar="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  ${notas.map((n) => `<cbc:Note>${n}</cbc:Note>`).join("")}
  <ds:DigestValue>abc123=</ds:DigestValue>
  <cac:DocumentResponse><cac:Response>
    <cbc:ResponseCode>${codigo}</cbc:ResponseCode>
    <cbc:Description>La Boleta numero B001-1, ha sido aceptada</cbc:Description>
  </cac:Response></cac:DocumentResponse>
</ar:ApplicationResponse>`;
  const zip = new AdmZip();
  zip.addFile("dummy/", Buffer.alloc(0));
  zip.addFile("R-20000000001-03-B001-00000001.xml", Buffer.from(xml));
  return zip.toBuffer().toString("base64");
}

describe("CDR de SUNAT", () => {
  test("0 sin notas → ACEPTADO, con hash", () => {
    const r = parseCdr(cdr("0"));
    expect(r).toMatchObject({ responseCode: "0", accepted: true, digestValue: "abc123=" });
    expect(resolverEstadoCdr(r)).toBe("ACEPTADO");
  });
  test("0 con notas 4xxx → OBSERVADO (válido)", () => {
    const r = parseCdr(cdr("0", ["4252 - El dato ingresado como atributo @listName es incorrecto"]));
    expect(resolverEstadoCdr(r)).toBe("OBSERVADO");
  });
  test("2xxx → RECHAZADO", () => {
    const r = parseCdr(cdr("2800"));
    expect(r.accepted).toBe(false);
    expect(resolverEstadoCdr(r)).toBe("RECHAZADO");
  });
  test("ZIP sin XML o vacío → error (nunca se asume aceptado)", () => {
    const zip = new AdmZip();
    zip.addFile("dummy/", Buffer.alloc(0));
    expect(() => parseCdr(zip.toBuffer().toString("base64"))).toThrow();
    expect(() => parseCdr("")).toThrow();
  });
});
