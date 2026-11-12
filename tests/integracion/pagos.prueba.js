// Prueba de integración de Pagos Yape/Plin: QR de enlace, enlace del teléfono,
// ingesta idempotente, tiempo real por Socket.IO, panel solo para el
// administrador, CSV y retención. Mismo contrato JSON que la app Android.
// Se ejecuta con tests/integracion/correr.sh (BD y Redis aislados).
const bcrypt = require("/app/node_modules/bcryptjs");
const { io } = require("/app/node_modules/socket.io-client");
const app = require("/app/src/infrastructure/web/app");
const gateway = require("/app/src/infrastructure/web/realtime/notifier.gateway");
const sequelize = require("/app/src/infrastructure/database/database");
const { Login } = require("/app/src/infrastructure/database/models/login");
const {
  NotifierDevice, NotifierRawNotification, NotifierPayment,
} = require("/app/src/infrastructure/database/models/notifier/notifier");
const { aplicarRetencion } = require("/app/src/application/services/notifier/retencion.service");

let fallos = 0;
const ok = (cond, msg) => { console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`); if (!cond) fallos++; };

const ORIGEN = (process.env.ALLOWED_ORIGINS || "").split(",")[0].trim();
const YAPE = "com.bcp.innovacxion.yapeapp";
const PLIN = "pe.com.interbank.mobilebanking";
let base;

async function http(metodo, ruta, { body, token, clave, origen = ORIGEN } = {}) {
  const headers = { "content-type": "application/json", "x-app-version": "1.0.0" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (clave) headers["x-device-key"] = clave;
  if (origen) headers.origin = origen;
  const r = await fetch(base + ruta, { method: metodo, headers, body: body ? JSON.stringify(body) : undefined });
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* CSV o 204 */ }
  return { status: r.status, body: json, texto, headers: r.headers };
}
const CLAVE = "Clave-Prueba-2026"; // gitleaks:allow (contraseña ficticia de prueba)
const login = async (usuario, password = CLAVE) => (await http("POST", "/auth/login", { body: { usuario, password } })).body.access_token;

/** Conecta al namespace /live; resuelve con el socket o con el error del handshake. */
function conectar(token, origen = ORIGEN) {
  return new Promise((resolve) => {
    const s = io(`${base}/live`, {
      auth: token ? { token } : {}, transports: ["websocket"], reconnection: false,
      extraHeaders: origen ? { origin: origen } : {},
    });
    s.on("connect", () => resolve({ socket: s }));
    s.on("connect_error", (e) => { s.close(); resolve({ error: e.message }); });
  });
}
const esperarEvento = (socket, evento, ms = 3000) => new Promise((resolve) => {
  const t = setTimeout(() => resolve(null), ms);
  socket.once(evento, (d) => { clearTimeout(t); resolve(d); });
});

const hace = (min) => new Date(Date.now() - min * 60 * 1000).toISOString();
const item = (n, packageName, text, postedAt = hace(1)) => ({ notifKey: `k${n}`, packageName, title: "Confirmación de Pago", text, postedAt });

(async () => {
  const server = app.listen(0);
  gateway.iniciar(server);
  base = `http://127.0.0.1:${server.address().port}`;

  const h = await bcrypt.hash(CLAVE, 4);
  await Login.bulkCreate([
    { id: 1, usuario: "admin", password: h, cargo: "Administrador", activo: true },
    { id: 2, usuario: "cajero", password: h, cargo: "Usuario", activo: true },
  ]);
  const admin = await login("admin");
  const cajero = await login("cajero");

  console.log("1) QR de enlace (panel)");
  let r = await http("POST", "/api/v1/devices/enroll-tokens", { token: cajero });
  ok(r.status === 403, "un Usuario no puede generar el QR → 403");
  r = await http("POST", "/api/v1/devices/enroll-tokens", { token: admin });
  ok(r.status === 201 && r.body.enrollToken?.length >= 32 && r.body.qr?.startsWith("data:image/png;base64,"), "el administrador obtiene código y QR en PNG");
  ok(r.headers.get("cache-control") === "no-store", "la respuesta no se cachea");
  ok(r.body.apiUrl === base, `sin NOTIFIER_PUBLIC_API_URL el QR apunta a la URL de la API (${r.body.apiUrl})`);
  const enrollToken = r.body.enrollToken;

  console.log("2) Enlace del teléfono");
  r = await http("POST", "/api/v1/devices/enroll", { origen: null, body: { enrollToken: "x".repeat(40), name: "Caja 1", appVersion: "1.0.0" } });
  ok(r.status === 401, "código inventado → 401");
  r = await http("POST", "/api/v1/devices/enroll", { origen: null, body: { enrollToken, name: "<script>", appVersion: "1.0.0" } });
  ok(r.status === 400, "nombre con caracteres no permitidos → 400");
  r = await http("POST", "/api/v1/devices/enroll", { origen: null, body: { enrollToken, name: "Caja 1", appVersion: "1.0.0" } });
  ok(r.status === 201 && r.body.deviceId && r.body.apiKey?.length >= 32 && r.body.name === "Caja 1", "código válido → deviceId y apiKey");
  const clave = r.body.apiKey;
  const device = await NotifierDevice.findByPk(r.body.deviceId);
  ok(device.api_key_hash.length === 64 && device.api_key_hash !== clave, "en la BD solo está el SHA-256 de la clave");
  r = await http("POST", "/api/v1/devices/enroll", { origen: null, body: { enrollToken, name: "Caja 2", appVersion: "1.0.0" } });
  ok(r.status === 401, "el mismo código no sirve dos veces");

  console.log("3) Latido");
  r = await http("GET", "/api/v1/devices/me", { origen: null });
  ok(r.status === 401, "sin X-Device-Key → 401");
  r = await http("GET", "/api/v1/devices/me", { origen: null, clave: "y".repeat(43) });
  ok(r.status === 401, "clave inventada → 401");
  r = await http("GET", "/api/v1/devices/me", { origen: null, clave });
  ok(r.status === 200 && r.body.id === device.id && r.body.name === "Caja 1", "clave válida → id y nombre (MeResponse)");

  console.log("4) Tiempo real");
  let c = await conectar(null);
  ok(c.error === "unauthorized", "socket sin token → rechazado");
  c = await conectar(cajero);
  ok(c.error === "unauthorized", "socket de un Usuario → rechazado");
  c = await conectar(admin, "https://malicioso.example");
  ok(Boolean(c.error), "socket desde un origen no permitido → rechazado");
  c = await conectar(admin);
  ok(Boolean(c.socket), "socket del administrador → conectado");
  const live = c.socket;

  console.log("5) Ingesta");
  const pagoYape = esperarEvento(live, "payment.created");
  const noReconocida = esperarEvento(live, "notification.unparsed");
  const lote = [
    item(1, YAPE, "Rosa Pin* te envió un pago por S/ 15.72. El cód. de seguridad es: 376"),
    item(2, PLIN, "JUAN PEREZ te ha plineado S/ 1,250.50"),
    item(3, PLIN, "Plin: formato nuevo que el parser no conoce"),
    item(4, PLIN, "Tu código de verificación es 482913"),
    item(5, YAPE, "Yapeaste S/ 10 a Ana", hace(8 * 24 * 60)),
  ];
  r = await http("POST", "/api/v1/notifications", { origen: null, clave, body: { items: lote } });
  ok(r.status === 202, `lote aceptado → 202 (${JSON.stringify(r.body)})`);
  ok(r.body.accepted === 4 && r.body.parsed === 2 && r.body.unparsed === 1 && r.body.ignored === 1 && r.body.rejected === 1 && r.body.duplicates === 0,
    "2 pagos, 1 no reconocida, 1 ignorada y 1 rechazada por antigua");
  const evento = await pagoYape;
  ok(evento?.amount === "15.72" && evento?.senderName === "Rosa Pin*" && evento?.nameMasked === true && evento?.securityCode === "376",
    "payment.created llega al panel con el monto como string");
  ok(Boolean(await noReconocida), "notification.unparsed llega al panel");
  const sensible = await NotifierRawNotification.findOne({ where: { notif_key: "k4" } });
  ok(sensible.text === "[redactado]" && sensible.status === "IGNORED", "un texto con código secreto se guarda redactado");

  r = await http("POST", "/api/v1/notifications", { origen: null, clave, body: { items: lote } });
  ok(r.status === 202 && r.body.duplicates === 4 && r.body.accepted === 0, "reenviar el mismo lote → duplicados, sin filas nuevas");
  ok((await NotifierPayment.count()) === 2, "siguen siendo 2 pagos");

  r = await http("POST", "/api/v1/notifications", { origen: null, clave, body: { items: [item(9, "com.otra.app", "hola")] } });
  ok(r.status === 422, "packageName no permitido → 422");
  r = await http("POST", "/api/v1/notifications", { origen: null, clave, body: { items: [] } });
  ok(r.status === 400, "lote vacío → 400");
  r = await http("POST", "/api/v1/notifications", { origen: null, clave, body: { items: [{ ...lote[0], postedAt: "ayer" }] } });
  ok(r.status === 400, "fecha no ISO → 400");

  r = await http("POST", "/api/v1/notifications", { origen: null, clave, body: { items: [item(10, YAPE, "Rosa Pin* te envió un pago por S/ 15.72")] } });
  const repetido = await NotifierPayment.findOne({ include: [{ model: NotifierRawNotification, as: "raw", where: { notif_key: "k10" } }] });
  ok(Boolean(repetido?.possible_duplicate_of_id), "mismo nombre y monto en 3 min → marcado como posible repetido");

  console.log("6) Panel");
  r = await http("GET", "/api/v1/payments", { token: cajero });
  ok(r.status === 403, "un Usuario no ve los pagos → 403");
  r = await http("GET", "/api/v1/payments?pageSize=10", { token: admin });
  ok(r.status === 200 && r.body.total === 3 && r.body.items.every((p) => typeof p.amount === "string"), "lista de pagos con montos string");
  r = await http("GET", "/api/v1/payments?provider=PLIN&q=juan", { token: admin });
  ok(r.body.total === 1 && r.body.items[0].amount === "1250.50", "filtro por proveedor y nombre");
  r = await http("GET", "/api/v1/payments/totals", { token: admin });
  ok(r.body.overall.total === "1281.94" && r.body.overall.count === 3, `totales exactos en NUMERIC (${r.body.overall.total})`);
  r = await http("GET", "/api/v1/payments/summary", { token: admin });
  ok(r.status === 200 && r.body.timezone === "America/Lima" && r.body.unparsed === 1, "resumen del día en hora de Lima");
  const id = (await http("GET", "/api/v1/payments?provider=YAPE&pageSize=1", { token: admin })).body.items[0].id;
  r = await http("GET", `/api/v1/payments/${id}`, { token: admin });
  ok(r.status === 200 && r.body.raw?.packageName === YAPE, "detalle con el texto original");
  r = await http("GET", "/api/v1/payments/no-es-uuid", { token: admin });
  ok(r.status === 400, "id inválido → 400");
  r = await http("GET", "/api/v1/payments?from=ayer", { token: admin });
  ok(r.status === 400, "filtro de fecha inválido → 400");
  r = await http("GET", "/api/v1/notifications/unparsed", { token: admin });
  ok(r.status === 200 && r.body.total === 1, "lista de no reconocidas");

  await NotifierPayment.update({ sender_name: "=HYPERLINK(\"x\")" }, { where: { id } });
  r = await http("GET", "/api/v1/payments/export.csv", { token: admin });
  ok(r.status === 200 && /text\/csv/.test(r.headers.get("content-type")) && r.texto.includes(`"'=HYPERLINK(""x"")"`), "CSV con fórmulas neutralizadas");
  ok(!r.texto.includes("376"), "el CSV no incluye el código de seguridad");

  console.log("7) Dispositivos y retención");
  r = await http("GET", "/api/v1/devices", { token: admin });
  ok(r.status === 200 && r.body.length === 1 && r.body[0].lastSeenAt, "lista de dispositivos con última conexión");
  r = await http("DELETE", `/api/v1/devices/${device.id}`, { token: admin });
  ok(r.status === 204, "revocar → 204");
  r = await http("GET", "/api/v1/devices/me", { origen: null, clave });
  ok(r.status === 401, "la clave revocada deja de servir");

  await NotifierPayment.update({ paid_at: new Date(Date.now() - 8 * 24 * 3600 * 1000) }, { where: {} });
  const ret = await aplicarRetencion();
  ok(ret.codigos >= 1 && (await NotifierPayment.count({ where: { security_code: "376" } })) === 0, "la retención borra los códigos de seguridad viejos");

  live.close();
  console.log(fallos ? `\n✗ ${fallos} fallo(s)` : "\n✓ Todas las pruebas pasaron");
  server.close();
  await sequelize.close();
  process.exit(fallos ? 1 : 0);
})().catch((err) => { console.error("ERROR INESPERADO", err); process.exit(1); });
