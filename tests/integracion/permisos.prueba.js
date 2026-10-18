// Prueba de integración de la Fase 6: matriz de permisos, formatos,
// credenciales cifradas del emisor, subidas, lista blanca de campos y
// emisión atómica de guías. Se ejecuta con tests/integracion/correr.sh.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const bcrypt = require("/app/node_modules/bcryptjs");
const app = require("/app/src/infrastructure/web/app");
const sequelize = require("/app/src/infrastructure/database/database");
const { Login } = require("/app/src/infrastructure/database/models/login");
const { REGLAS, buscarRegla } = require("/app/src/infrastructure/web/middleware/permisos");
const credenciales = require("/app/src/application/services/credenciales.service");
const EmisorCredencial = require("/app/src/infrastructure/database/models/facturacion/emisorCredencial");

let fallos = 0;
const ok = (cond, msg) => { console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`); if (!cond) fallos++; };
let base;

async function http(metodo, ruta, { body, token, form } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  let cuerpo;
  if (form) cuerpo = form;
  else if (body !== undefined) { headers["content-type"] = "application/json"; cuerpo = JSON.stringify(body); }
  const r = await fetch(base + ruta, { method: metodo, headers, body: cuerpo });
  let json = null;
  try { json = await r.json(); } catch { /* sin cuerpo */ }
  return { status: r.status, body: json };
}
const login = async (usuario, password) =>
  (await http("POST", "/auth/login", { body: { usuario, password } })).body.access_token;

/** Rutas registradas en Express 4: [{ metodo, ruta }] */
function rutasExpress() {
  const out = [];
  const prefijo = (layer) => {
    const m = layer.regexp?.source.match(/^\^\\\/(.+?)\\\/\?\(\?=/);
    return m ? "/" + m[1].replace(/\\\//g, "/") : "";
  };
  const recorrer = (stack, pre) => {
    for (const layer of stack) {
      if (layer.route) {
        for (const metodo of Object.keys(layer.route.methods)) {
          out.push({ metodo: metodo.toUpperCase(), ruta: (pre + layer.route.path).replace(/\/$/, "") || "/" });
        }
      } else if (layer.name === "router" && layer.handle.stack) {
        recorrer(layer.handle.stack, pre + prefijo(layer));
      }
    }
  };
  recorrer(app._router.stack, "");
  return out;
}

(async () => {
  const server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;

  const h = await bcrypt.hash("Clave-Prueba-2026", 4);
  await Login.bulkCreate([
    { id: 1, usuario: "admin", password: h, cargo: "Administrador", activo: true },
    { id: 2, usuario: "sin_formatos", password: h, cargo: "Usuario", activo: true },
    { id: 3, usuario: "cajero", password: h, cargo: "Usuario", activo: true },
  ]);
  await sequelize.query(`
    INSERT INTO usuario_formatos (usuario_id, formato_id, "createdAt", "updatedAt")
      SELECT 3, id, now(), now() FROM formatos WHERE key IN ('ticket', 'boleta', 'guiarem');
    INSERT INTO "TipoComprobante" (id, descripcion) VALUES ('03','Boleta'),('09','Guía remitente');
    INSERT INTO "TipoDocumento" (id, descripcion) VALUES ('1','DNI'),('6','RUC');
    INSERT INTO "Unidad" (id, descripcion) VALUES ('NIU','Unidad');
    INSERT INTO "Emisor" (id, ruc, razon_social) VALUES (1,'20000000001','EMISOR PRUEBA'), (2,'20000000002','OTRO');
    INSERT INTO "Serie" (id, tipo_comprobante_id, serie, correlativo) VALUES (1,'03','B001',1),(2,'09','T001',1);
  `).catch(async (e) => { console.log("  (seed)", e.message); throw e; });
  const admin = await login("admin", "Clave-Prueba-2026");
  const sinFormatos = await login("sin_formatos", "Clave-Prueba-2026");
  const cajero = await login("cajero", "Clave-Prueba-2026");

  console.log("1) Cobertura de la matriz");
  const rutas = rutasExpress().filter((r) => r.metodo !== "OPTIONS" && !r.ruta.startsWith("/health") && !r.ruta.startsWith("/auth/l") && r.ruta !== "/auth/refresh");
  const sinRegla = rutas.filter((r) => !buscarRegla(r.metodo, r.ruta.replace(/:[A-Za-z_]+/g, "1")));
  ok(sinRegla.length === 0, `toda ruta tiene regla (${rutas.length} rutas)${sinRegla.length ? ": " + sinRegla.map((r) => `${r.metodo} ${r.ruta}`).join(", ") : ""}`);
  const huerfanas = REGLAS.filter(([m, ruta]) => !rutas.some((r) => r.metodo === m && r.ruta === ruta));
  ok(huerfanas.length === 0, `ninguna regla sin ruta${huerfanas.length ? ": " + huerfanas.map(([m, r]) => `${m} ${r}`).join(", ") : ""}`);
  let r = await http("GET", "/ruta/que/no/existe", { token: admin });
  ok(r.status === 403, "ruta sin regla → 403 (denegar por defecto)");

  console.log("2) Rutas solo-admin rechazan al Usuario (sin llegar al controlador)");
  const soloAdmin = REGLAS.filter(([, , roles]) => !roles.includes("Usuario"));
  const fugas = [];
  for (const [m, ruta] of soloAdmin) {
    const res = await http(m, ruta.replace(/:[A-Za-z_]+/g, "1"), { token: cajero, body: m === "GET" ? undefined : {} });
    if (res.status !== 403) fugas.push(`${m} ${ruta} → ${res.status}`);
  }
  ok(fugas.length === 0, `${soloAdmin.length} rutas solo-admin → 403 para Usuario${fugas.length ? ": " + fugas.join(", ") : ""}`);

  console.log("3) Formatos exigidos en el servidor");
  r = await http("POST", "/ticket", { token: sinFormatos, body: {} });
  ok(r.status === 403 && /formato: ticket/.test(r.body.message), `ticket sin formato → 403 (${r.body.message})`);
  r = await http("POST", "/ticket", { token: cajero, body: {} });
  ok(r.status !== 403, `ticket con formato pasa la matriz (${r.status})`);
  r = await http("POST", "/comprobante/emision", { token: cajero, body: { tipo_comprobante_id: "01" } });
  ok(r.status === 403 && /factura/.test(r.body.message), "factura sin el formato factura → 403");
  r = await http("POST", "/comprobante/emision", { token: cajero, body: { tipo_comprobante_id: "03" } });
  ok(r.status === 400, `boleta con formato → pasa a la validación (${r.status})`);
  r = await http("PUT", "/formatos/usuario/2", { token: sinFormatos, body: { formatos: ["factura"] } });
  ok(r.status === 403, "un Usuario no puede asignarse formatos");
  r = await http("GET", "/formatos/usuario/3", { token: sinFormatos });
  ok(r.status === 403, "ni ver los de otro usuario");
  r = await http("PUT", "/formatos/usuario/2", { token: admin, body: { formatos: ["ticket"] } });
  ok(r.status === 200, "el admin asigna el formato ticket");
  r = await http("POST", "/ticket", { token: sinFormatos, body: {} });
  ok(r.status !== 403, `el permiso rige al instante, sin esperar la caché (${r.status})`);
  r = await http("PUT", "/formatos/usuario/2", { token: admin, body: { formatos: ["inventado"] } });
  ok(r.status === 400, "formato desconocido → 400");

  console.log("4) Credenciales SUNAT del emisor");
  r = await http("PUT", "/emisor/1", { token: admin, body: { ruc: "20000000001", razon_social: "EMISOR PRUEBA", usuario_sol: "MODDATOS", clave_sol: "Sol-Secreta-1", client_id: "cid", client_secret: "Secreto-API-1" } });
  ok(r.status === 200 && r.body.tiene_clave_sol && r.body.tiene_client_secret && !("clave_sol" in r.body), "admin guarda las credenciales; la respuesta no las incluye");
  const fila = await EmisorCredencial.findByPk(1);
  ok(fila.clave_sol_cifrada.startsWith("v1:") && !fila.clave_sol_cifrada.includes("Sol-Secreta"), "en la BD la clave SOL está cifrada");
  const plano = await credenciales.obtener(1);
  ok(plano.clave_sol === "Sol-Secreta-1" && plano.client_secret === "Secreto-API-1", "el servicio la descifra para SUNAT");
  for (const [quien, token] of [["Usuario", cajero], ["Administrador", admin]]) {
    r = await http("GET", "/emisor", { token });
    const texto = JSON.stringify(r.body);
    ok(r.status === 200 && !/Sol-Secreta|Secreto-API|"clave_sol"|"client_secret"/.test(texto), `GET /emisor (${quien}) no devuelve secretos`);
  }
  r = await http("PUT", "/emisor/1", { token: admin, body: { razon_social: "EMISOR PRUEBA SAC", clave_sol: "" } });
  ok(r.status === 200 && (await credenciales.obtener(1)).clave_sol === "Sol-Secreta-1", "clave vacía en la edición = se conserva");
  await EmisorCredencial.create({ emisor_id: 2, clave_sol_cifrada: fila.clave_sol_cifrada });
  const robada = await credenciales.obtener(2).then(() => null, (e) => e);
  ok(robada !== null, "copiar el cifrado a otro emisor no se puede descifrar (AAD)");
  r = await http("PUT", "/emisor/1", { token: admin, body: { logo_url: "http://evil/x.png" } });
  ok(r.status === 400, "logo_url por el body → 400 (solo por la subida)");

  console.log("5) Subida de imágenes por contenido real");
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c60000000049454e44ae426082", "hex");
  let form = new FormData();
  form.append("logo", new Blob([png], { type: "image/png" }), "../../../evil.png");
  r = await http("PUT", "/emisor/1/logo", { token: admin, form });
  const archivo = r.body?.logo_url && path.join("/app/src", r.body.logo_url);
  ok(r.status === 200 && /^\/uploads\/empresa\/logo-[0-9a-f]{32}\.png$/.test(r.body.logo_url) && fs.existsSync(archivo),
    `PNG real → guardado con nombre aleatorio (${r.body?.logo_url})`);
  if (archivo) fs.rmSync(archivo, { force: true });
  const antes = fs.readdirSync("/app/src/uploads/profiles").length;
  form = new FormData();
  form.append("image", new Blob(["<html><script>alert(1)</script></html>"], { type: "image/png" }), "foto.png");
  r = await http("PUT", "/login/3/image", { token: cajero, form });
  ok(r.status === 400 && fs.readdirSync("/app/src/uploads/profiles").length === antes, "HTML disfrazado de .png → 400 y nada en disco");
  form = new FormData();
  form.append("image", new Blob([png], { type: "image/png" }), "a.png");
  r = await http("PUT", "/login/1/image", { token: cajero, form });
  ok(r.status === 403, "un Usuario no cambia la foto de otro");

  console.log("6) Lista blanca de campos");
  r = await http("PUT", "/serie/1", { token: admin, body: { correlativo: 1 } });
  ok(r.status === 400 && /correlativo/.test(r.body.message), "editar el correlativo de una serie → 400");
  r = await http("POST", "/servicios", { token: cajero, body: { id: 999, nombre: "X", cantidad: 1, descripcion: "d", estado: "Pendiente", total: 1, acuenta: 0 } });
  ok(r.status === 400, "fijar el id de un servicio → 400");
  r = await http("POST", "/servicios", { token: cajero, body: { nombre: "X", cantidad: 1, descripcion: "d", estado: "Pendiente", total: 1, acuenta: 0, createdAt: "2000-01-01" } });
  ok(r.status === 400, "fijar timestamps → 400");
  r = await http("POST", "/cliente", { token: cajero, body: { tipo_documento_id: "1", nrodoc: "123", razon_social: "Juan" } });
  ok(r.status === 400 && /DNI/.test(r.body.message), "DNI de 3 dígitos → 400");
  r = await http("POST", "/cliente", { token: cajero, body: { tipo_documento_id: "1", nrodoc: "12345678", razon_social: "Juan" } });
  ok(r.status === 200, "cliente válido → 200");
  r = await http("POST", "/envio_resumen", { token: admin, body: {} });
  ok(r.status === 403, "escritura cruda de envio_resumen eliminada");

  console.log("7) Guía: cabecera + ítems en una transacción");
  const guia = (extra = {}) => ({
    emisor_id: 1, tipo_guia: "09", serie_id: 2, fecha_emision: "2026-10-17", fecha_traslado: "2026-10-17",
    motivo_traslado_id: "01", peso_bruto_total: 5, unidad_peso_id: "KGM", modalidad_traslado: "01",
    transportista_ruc: "20123456789", transportista_razon_social: "TRANSP SAC",
    ubigeo_partida: "150101", direccion_partida: "Av. A 1", ubigeo_llegada: "150102", direccion_llegada: "Av. B 2",
    items: [{ descripcion: "Cajas", unidad_id: "NIU", cantidad: 2 }, { descripcion: "Bolsas", unidad_id: "NIU", cantidad: 3 }],
    ...extra,
  });
  r = await http("POST", "/guia/emision", { token: cajero, body: guia({ items: [] }) });
  ok(r.status === 400, "guía sin ítems → 400");
  r = await http("POST", "/guia/emision", { token: cajero, body: guia({ estado_sunat: "AC" }) });
  ok(r.status === 400, "estado_sunat enviado por el cliente → 400");
  r = await http("POST", "/guia/emision", { token: cajero, body: guia({ tipo_guia: "31" }) });
  ok(r.status === 403, "guía transportista sin ese formato → 403");
  r = await http("POST", "/guia/emision", { token: cajero, body: guia({ items: [{ descripcion: "X", unidad_id: "ZZZ", cantidad: 1 }] }) });
  const [[g0]] = await sequelize.query(`SELECT count(*)::int n, (SELECT correlativo FROM "Serie" WHERE id = 2) c FROM "GuiaRemision"`);
  ok(r.status === 400 && g0.n === 0 && g0.c === 1, `ítem inválido (unidad inexistente) → rollback total (${r.status}, guías=${g0.n}, serie=${g0.c})`);
  r = await http("POST", "/guia/emision", { token: cajero, body: guia() });
  const [[g1]] = await sequelize.query(`SELECT g.correlativo, g.estado_sunat, (SELECT count(*)::int FROM "DetalleGuia" d WHERE d.guia_id = g.id) items FROM "GuiaRemision" g`);
  ok(g1 && g1.correlativo === 1 && g1.items === 2, `guía T001-1 con sus 2 ítems guardada en una transacción (${JSON.stringify(g1)})`);
  ok(r.status === 422 || r.status === 202, `el envío a SUNAT se intenta después (sin credenciales de prueba → ${r.status}, estado ${g1?.estado_sunat})`);

  console.log("8) AUTH_ENFORCE no puede apagarse en producción");
  const valor = (env) => execFileSync("node", ["-e", "console.log(require('/app/src/infrastructure/web/middleware/authGlobal.middleware').AUTH_ENFORCE)"],
    { env: { ...process.env, ...env }, encoding: "utf8" }).trim().split("\n").pop();
  ok(valor({ NODE_ENV: "production", AUTH_ENFORCE: "false" }) === "true", "producción + AUTH_ENFORCE=false → sigue activa");
  ok(valor({ NODE_ENV: "development", AUTH_ENFORCE: "false" }) === "false", "desarrollo + AUTH_ENFORCE=false → modo auditoría");

  console.log(fallos ? `\n✗ ${fallos} fallo(s)` : "\n✓ Todas las pruebas pasaron");
  server.close();
  await sequelize.close();
  process.exit(fallos ? 1 : 0);
})().catch((err) => { console.error("ERROR INESPERADO", err); process.exit(1); });
