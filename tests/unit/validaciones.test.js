const { crearUsuarioSchema, actualizarUsuarioSchema, cambiarPasswordSchema } = require("../../src/application/validation/usuario.schema");
const { clienteSchema } = require("../../src/application/validation/cliente.schema");
const { emisionSchema } = require("../../src/application/validation/emision.schema");
const { guiaEmisionSchema } = require("../../src/application/validation/guia.schema");
const { detectarTipo } = require("../../src/infrastructure/web/middleware/subidaImagen");
const soloCampos = require("../../src/infrastructure/web/middleware/soloCampos");
const Serie = require("../../src/infrastructure/database/models/facturacion/serie");

const ok = (schema, d) => schema.safeParse(d).success;

describe("política de contraseñas y usuarios", () => {
  const base = { usuario: "cajero1", cargo: "Usuario" };
  test.each([
    ["corta", "Abc-12345"], ["común", "password123"], ["contiene el usuario", "xx-cajero1-2026"],
    ["> 72 bytes", "ñ".repeat(37)],
  ])("rechaza contraseña %s", (_d, password) => expect(ok(crearUsuarioSchema, { ...base, password })).toBe(false));
  test("acepta una contraseña razonable", () => expect(ok(crearUsuarioSchema, { ...base, password: "Imprenta-Lima-2026" })).toBe(true)); // gitleaks:allow (contraseña ficticia de prueba)
  test("no acepta campos extra (activo, token_version)", () => {
    expect(ok(crearUsuarioSchema, { ...base, password: "Imprenta-Lima-2026", activo: false })).toBe(false); // gitleaks:allow (contraseña ficticia de prueba)
  });
  test("cargo fuera de la lista → rechazado", () => {
    expect(ok(crearUsuarioSchema, { ...base, password: "Imprenta-Lima-2026", cargo: "Root" })).toBe(false); // gitleaks:allow (contraseña ficticia de prueba)
  });
  test("edición: contraseña vacía = no cambiarla", () => {
    expect(actualizarUsuarioSchema.parse({ password: "", confirmPassword: "" }).password).toBeUndefined();
  });
  test("cambio propio: la nueva no puede ser igual a la actual", () => {
    expect(ok(cambiarPasswordSchema, { password_actual: "Imprenta-Lima-2026", password_nueva: "Imprenta-Lima-2026" })).toBe(false); // gitleaks:allow (contraseña ficticia de prueba)
  });
});

describe("cliente: documento según tipo (catálogo 06)", () => {
  test.each([["1", "12345678", true], ["1", "1234567", false], ["6", "20123456789", true], ["6", "30123456789", false], ["0", "", true]])(
    "tipo %s, número '%s' → %s",
    (tipo, nrodoc, esperado) => expect(ok(clienteSchema, { tipo_documento_id: tipo, nrodoc, razon_social: "X" })).toBe(esperado)
  );
});

describe("emisión: el cliente no decide números ni montos", () => {
  const b = { tipo_comprobante_id: "03", emisor_id: 1, serie_id: 1, items: [{ descripcion: "X", cantidad: 1, precio_unitario: 5 }] };
  test("válida", () => expect(ok(emisionSchema, b)).toBe(true));
  test.each(["correlativo", "total", "igv", "estado_sunat"])("rechaza %s enviado por el cliente", (campo) => {
    expect(ok(emisionSchema, { ...b, [campo]: 1 })).toBe(false);
  });
  test("sin ítems o con cantidad 0 → rechazada", () => {
    expect(ok(emisionSchema, { ...b, items: [] })).toBe(false);
    expect(ok(emisionSchema, { ...b, items: [{ descripcion: "X", cantidad: 0, precio_unitario: 5 }] })).toBe(false);
  });
});

describe("guía", () => {
  const g = {
    emisor_id: 1, tipo_guia: "09", serie_id: 2, fecha_emision: "2026-01-10", fecha_traslado: "2026-01-10",
    motivo_traslado_id: "01", peso_bruto_total: 5, unidad_peso_id: "KGM", modalidad_traslado: "02",
    vehiculo_placa: "ABC123", conductor_nrodoc: "12345678",
    ubigeo_partida: "150101", direccion_partida: "A", ubigeo_llegada: "150102", direccion_llegada: "B",
    items: [{ descripcion: "Cajas", cantidad: 2 }],
  };
  test("válida", () => expect(ok(guiaEmisionSchema, g)).toBe(true));
  test("traslado antes de la emisión → rechazada", () => expect(ok(guiaEmisionSchema, { ...g, fecha_traslado: "2026-01-09" })).toBe(false));
  test("privado sin placa → rechazada", () => expect(ok(guiaEmisionSchema, { ...g, vehiculo_placa: null })).toBe(false));
  test("estado enviado por el cliente → rechazada", () => expect(ok(guiaEmisionSchema, { ...g, estado_sunat: "AC" })).toBe(false));
});

describe("subidas: tipo por contenido", () => {
  test.each([
    ["jpg", Buffer.from([0xff, 0xd8, 0xff, 0xe0])],
    ["png", Buffer.from("89504e470d0a1a0a0000", "hex")],
    ["webp", Buffer.from("RIFF0000WEBPVP8 ", "ascii")],
    [null, Buffer.from("<svg onload=alert(1)>")],
    [null, Buffer.from("GIF89a")],
    [null, Buffer.alloc(0)],
  ])("%s", (esperado, buf) => expect(detectarTipo(buf)).toBe(esperado));
});

describe("lista blanca de campos", () => {
  const evaluar = (metodo, body, opciones) => {
    let error = null;
    soloCampos(Serie, opciones)({ method: metodo, body }, {}, (e) => { error = e || null; });
    return error;
  };
  test("columnas del modelo → pasa", () => expect(evaluar("POST", { serie: "B002", tipo_comprobante_id: "03" })).toBeNull());
  test("campo inexistente → 400", () => expect(evaluar("POST", { serie: "B002", es_admin: true })?.statusCode).toBe(400));
  test("timestamps e id autoincremental → 400", () => {
    expect(evaluar("POST", { serie: "B002", createdAt: "2000-01-01" })?.statusCode).toBe(400);
    expect(evaluar("PUT", { id: 9 })?.statusCode).toBe(400);
  });
  test("campo excluido (correlativo al editar) → 400", () => {
    expect(evaluar("PUT", { correlativo: 1 }, { excluir: ["correlativo"] })?.statusCode).toBe(400);
  });
  test("cuerpo que no es objeto → 400", () => expect(evaluar("POST", ["x"])?.statusCode).toBe(400));
});
