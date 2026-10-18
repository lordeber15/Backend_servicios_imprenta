const { buscarRegla, REGLAS } = require("../../src/infrastructure/web/middleware/permisos");
const permisos = require("../../src/infrastructure/web/middleware/permisos");

/** Ejecuta el middleware y devuelve el error (o null si deja pasar). */
function evaluar(metodo, ruta, user, body = {}) {
  let resultado;
  permisos({ method: metodo, path: ruta, user, body }, {}, (err) => { resultado = err || null; });
  return resultado;
}
const admin = { id: 1, cargo: "Administrador", formatos: [] };
const cajero = (formatos = []) => ({ id: 2, cargo: "Usuario", formatos });

describe("matriz de permisos", () => {
  test("ruta desconocida → 403 aunque sea admin (denegar por defecto)", () => {
    expect(buscarRegla("GET", "/inventada")).toBeUndefined();
    expect(evaluar("GET", "/inventada", admin)?.statusCode).toBe(403);
  });
  test("parámetros de ruta no cruzan segmentos", () => {
    expect(buscarRegla("DELETE", "/cliente/1/otra")).toBeUndefined();
    expect(buscarRegla("GET", "/comprobante/5/pdf")?.ruta).toBe("/comprobante/:id/pdf");
  });
  test("HEAD se evalúa como GET", () => {
    expect(buscarRegla("HEAD", "/caja/actual")?.metodo).toBe("GET");
  });
  test.each([
    ["DELETE", "/comprobante/1"], ["POST", "/comunicacion-baja"], ["PUT", "/emisor/1"], ["GET", "/login"],
    ["PUT", "/formatos/usuario/2"], ["POST", "/caja/apertura"], ["GET", "/reportes/documentos"],
  ])("solo admin: %s %s", (m, r) => {
    expect(evaluar(m, r, cajero(["ticket", "boleta", "factura"]))?.statusCode).toBe(403);
    expect(evaluar(m, r, admin)).toBeNull();
  });
  test("emitir exige el formato del tipo de comprobante", () => {
    expect(evaluar("POST", "/comprobante/emision", cajero(["boleta"]), { tipo_comprobante_id: "03" })).toBeNull();
    expect(evaluar("POST", "/comprobante/emision", cajero(["boleta"]), { tipo_comprobante_id: "01" })?.statusCode).toBe(403);
    expect(evaluar("POST", "/comprobante/emision", admin, { tipo_comprobante_id: "01" })).toBeNull();
  });
  test("guía 31 exige guiatransp; 09 exige guiarem", () => {
    expect(evaluar("POST", "/guia/emision", cajero(["guiarem"]), { tipo_guia: "31" })?.statusCode).toBe(403);
    expect(evaluar("POST", "/guia/emision", cajero(["guiarem"]), { tipo_guia: "09" })).toBeNull();
  });
  test("sin usuario autenticado → 401", () => {
    expect(evaluar("GET", "/caja/actual", undefined)?.statusCode).toBe(401);
  });
  test("las rutas públicas no pasan por la matriz", () => {
    expect(evaluar("POST", "/auth/login", undefined)).toBeNull();
    expect(evaluar("GET", "/health/ready", undefined)).toBeNull();
  });
  test("ninguna regla duplicada (la segunda nunca se aplicaría)", () => {
    const claves = REGLAS.map(([m, r]) => `${m} ${r}`);
    expect(claves.length).toBe(new Set(claves).size);
  });
});
