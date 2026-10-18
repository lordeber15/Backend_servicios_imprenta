// Prueba de integración de la sesión (Fase 5): login, refresh rotativo,
// reutilización, logout, revocación por cambio de credenciales y auditoría.
// Se ejecuta con tests/integracion/correr.sh (BD y Redis aislados).
const crypto = require("crypto");
const bcrypt = require("/app/node_modules/bcryptjs");
const jwt = require("/app/node_modules/jsonwebtoken");
const app = require("/app/src/infrastructure/web/app");
const sequelize = require("/app/src/infrastructure/database/database");
const { Login } = require("/app/src/infrastructure/database/models/login");
const RefreshToken = require("/app/src/infrastructure/database/models/auth/refreshToken");
const AuditLog = require("/app/src/infrastructure/database/models/auth/auditLog");

let fallos = 0;
const ok = (cond, msg) => { console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`); if (!cond) fallos++; };

const ORIGEN = (process.env.ALLOWED_ORIGINS || "").split(",")[0].trim();
let base;

async function http(metodo, ruta, { body, token, cookie, origen = ORIGEN } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (cookie) headers.cookie = cookie;
  if (origen) headers.origin = origen;
  const r = await fetch(base + ruta, { method: metodo, headers, body: body ? JSON.stringify(body) : undefined });
  const setCookie = r.headers.getSetCookie();
  const rt = setCookie.find((c) => c.startsWith("imprenta_rt="));
  let json = null;
  try { json = await r.json(); } catch { /* 204 */ }
  return { status: r.status, body: json, setCookie: rt, cookie: rt ? rt.split(";")[0] : null };
}
const login = (usuario, password) => http("POST", "/auth/login", { body: { usuario, password } });

(async () => {
  const server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;

  // Hash con cost 10 (como los usuarios existentes) para comprobar el rehash.
  const h10 = await bcrypt.hash("Clave-Admin-2026", 10);
  await Login.bulkCreate([
    { id: 1, usuario: "Admin", password: h10, cargo: "Administrador", activo: true },
    { id: 2, usuario: "cajero", password: await bcrypt.hash("Clave-Cajero-2026", 10), cargo: "Usuario", activo: true },
  ]);
  await sequelize.query(`SELECT setval(pg_get_serial_sequence('logins','id'), 10)`);

  console.log("1) Login");
  let r = await login("admin", "incorrecta");
  ok(r.status === 401 && r.body.message === "Usuario o contraseña incorrectos", "contraseña incorrecta → 401 genérico");
  r = await login("noexiste", "incorrecta");
  ok(r.status === 401 && r.body.message === "Usuario o contraseña incorrectos", "usuario inexistente → mismo 401 genérico");
  r = await login("ADMIN", "Clave-Admin-2026");
  ok(r.status === 200 && r.body.access_token && r.body.usuario?.cargo === "Administrador", "login correcto (usuario sin distinguir mayúsculas)");
  ok(!("token" in r.body) && !("password" in r.body.usuario) && !("token_version" in r.body.usuario), "la respuesta no trae token legado, hash ni versión");
  ok(/HttpOnly/i.test(r.setCookie) && /SameSite=Strict/i.test(r.setCookie) && /Path=\/auth/.test(r.setCookie) && /Expires=/.test(r.setCookie),
    `cookie httpOnly/SameSite=Strict/Path=/auth: ${r.setCookie?.replace(/=[^;]+/, "=…")}`);
  ok(r.body.expires_in > 800 && r.body.expires_in <= 900, `access token de 15 min (expires_in ${r.body.expires_in})`);
  const admin = { token: r.body.access_token, cookie: r.cookie };
  const valorCookie = decodeURIComponent(admin.cookie.split("=")[1]);
  const fila = await RefreshToken.findOne({ where: { usuario_id: 1 } });
  ok(fila.token_hash === crypto.createHash("sha256").update(valorCookie).digest("hex") && fila.token_hash !== valorCookie,
    "en la BD solo está el SHA-256 del refresh");
  ok(bcrypt.getRounds((await Login.findByPk(1)).password) === 12, "hash rehecho con cost 12 al iniciar sesión");

  console.log("2) Access token");
  r = await http("GET", "/login", { token: admin.token });
  ok(r.status === 200 && Array.isArray(r.body), "Bearer válido → 200");
  r = await http("GET", "/login");
  ok(r.status === 401, "sin token → 401");
  const payload = jwt.decode(admin.token);
  const sinFirma = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url") + "." +
    Buffer.from(JSON.stringify(payload)).toString("base64url") + ".";
  r = await http("GET", "/login", { token: sinFirma });
  ok(r.status === 401, "token alg=none → 401");
  r = await http("GET", "/login", { token: jwt.sign({ id: payload.id, cargo: payload.cargo, tv: payload.tv }, "otro-secreto-cualquiera-de-32-chars!!", { expiresIn: "5m" }) });
  ok(r.status === 401, "token firmado con otro secreto → 401");
  r = await http("GET", "/login", { token: jwt.sign({ id: 1, cargo: "Administrador", tv: 0, exp: Math.floor(Date.now() / 1000) - 10 }, process.env.JWT_SECRET) });
  ok(r.status === 401, "token vencido → 401");

  console.log("3) Refresh rotativo y protección CSRF");
  r = await http("POST", "/auth/refresh", { cookie: admin.cookie, origen: null });
  ok(r.status === 403, "refresh sin Origin → 403");
  r = await http("POST", "/auth/refresh", { cookie: admin.cookie, origen: "https://evil.example" });
  ok(r.status === 403, "refresh desde otro origen → 403");
  r = await http("POST", "/auth/refresh");
  ok(r.status === 401, "refresh sin cookie → 401");
  const r1 = await http("POST", "/auth/refresh", { cookie: admin.cookie });
  ok(r1.status === 200 && r1.cookie && r1.cookie !== admin.cookie && r1.body.access_token, "refresh → access nuevo y cookie ROTADA");
  r = await http("GET", "/login", { token: r1.body.access_token });
  ok(r.status === 200, "el access renovado funciona");

  console.log("4) Reutilización de un refresh ya rotado (robo)");
  r = await http("POST", "/auth/refresh", { cookie: admin.cookie });
  ok(r.status === 401 && /revocada/i.test(r.body.message), `refresh viejo → 401 "${r.body.message}"`);
  r = await http("POST", "/auth/refresh", { cookie: r1.cookie });
  ok(r.status === 401, "la familia entera quedó revocada: el refresh nuevo tampoco sirve");
  await new Promise((res) => setTimeout(res, 300)); // la bitácora de esta acción no se espera
  ok(await AuditLog.count({ where: { accion: "refresh_reutilizado", usuario_id: 1 } }) === 1,
    "reutilización registrada UNA vez (el token revocado por la alarma ya no la repite)");

  console.log("5) Logout");
  r = await login("admin", "Clave-Admin-2026");
  const s2 = { token: r.body.access_token, cookie: r.cookie };
  r = await http("POST", "/auth/logout", { cookie: s2.cookie });
  ok(r.status === 204 && /imprenta_rt=;/.test(r.setCookie || ""), "logout → 204 y borra la cookie");
  r = await http("POST", "/auth/refresh", { cookie: s2.cookie });
  ok(r.status === 401, "refresh tras logout → 401");

  console.log("6) Desactivar a un usuario corta su acceso al instante");
  r = await login("cajero", "Clave-Cajero-2026");
  const cajero = { token: r.body.access_token, cookie: r.cookie };
  r = await login("admin", "Clave-Admin-2026");
  Object.assign(admin, { token: r.body.access_token, cookie: r.cookie });
  r = await http("GET", "/login", { token: cajero.token });
  ok(r.status === 403, "Usuario no puede listar usuarios → 403");
  r = await http("PUT", "/login/2", { token: admin.token, body: { activo: false } });
  ok(r.status === 200 && r.body.activo === false, "admin desactiva al cajero");
  r = await http("GET", "/caja/actual", { token: cajero.token });
  ok(r.status === 401, "el access token vigente del cajero → 401");
  r = await http("POST", "/auth/refresh", { cookie: cajero.cookie });
  ok(r.status === 401, "y su refresh también");
  r = await login("cajero", "Clave-Cajero-2026");
  ok(r.status === 403 && /desactivada/.test(r.body.message), "login de cuenta desactivada → 403");
  await http("PUT", "/login/2", { token: admin.token, body: { activo: true } });

  console.log("7) Cambio de la propia contraseña");
  r = await login("cajero", "Clave-Cajero-2026");
  Object.assign(cajero, { token: r.body.access_token, cookie: r.cookie });
  r = await http("PUT", "/auth/password", { token: cajero.token, body: { password_actual: "mal", password_nueva: "Nueva-Clave-2026" } });
  ok(r.status === 400 && /actual/.test(r.body.message), "contraseña actual incorrecta → 400");
  r = await http("PUT", "/auth/password", { token: cajero.token, body: { password_actual: "Clave-Cajero-2026", password_nueva: "corta" } });
  ok(r.status === 400 && /10 caracteres/.test(r.body.message), "política: menos de 10 caracteres → 400");
  r = await http("PUT", "/auth/password", { token: cajero.token, body: { password_actual: "Clave-Cajero-2026", password_nueva: "Nueva-Clave-2026" } });
  ok(r.status === 200, "un Usuario (no admin) cambia su contraseña");
  r = await http("GET", "/caja/actual", { token: cajero.token });
  ok(r.status === 401, "sus sesiones se cerraron");
  r = await login("cajero", "Nueva-Clave-2026");
  ok(r.status === 200, "entra con la nueva");

  console.log("8) Gestión de usuarios");
  r = await http("POST", "/login", { token: admin.token, body: { usuario: "nuevo", password: "123", cargo: "Usuario" } });
  ok(r.status === 400, `contraseña débil al crear → 400 (${r.body.message})`);
  r = await http("POST", "/login", { token: admin.token, body: { usuario: "nuevo", password: "Una-Clave-Larga-1", cargo: "Usuario", activo: false, token_version: 9 } });
  ok(r.status === 400, "campos extra (mass assignment) → 400");
  r = await http("POST", "/login", { token: admin.token, body: { usuario: "CAJERO", password: "Una-Clave-Larga-1", cargo: "Usuario" } });
  ok(r.status === 409, "nombre duplicado sin distinguir mayúsculas → 409");
  r = await http("DELETE", "/login/1", { token: admin.token });
  ok(r.status === 409, "el admin no puede desactivarse a sí mismo → 409");
  r = await http("PUT", "/login/1", { token: admin.token, body: { cargo: "Usuario" } });
  ok(r.status === 409 && /último Administrador/.test(r.body.message), "no se puede degradar al último Administrador → 409");

  console.log("9) Límite de intentos de login");
  // El cajero ya tiene 1 intento fallido (el 403 de cuenta desactivada del paso 6).
  const intentos = [];
  for (let i = 0; i < 10; i++) intentos.push((await login("cajero", `mala-${i}`)).status);
  ok(intentos.slice(0, 9).every((s) => s === 401) && intentos[9] === 429, `10 fallos en 15 min y el siguiente → 429 (${intentos.join(",")})`);
  r = await login("admin", "Clave-Admin-2026");
  ok(r.status === 200, "el límite es por cuenta: otro usuario de la misma IP entra");

  console.log("10) Bitácora");
  const acciones = (await AuditLog.findAll({ attributes: ["accion"], raw: true })).map((a) => a.accion);
  for (const a of ["login_ok", "login_fallido", "logout", "usuario_actualizado", "password_cambiada", "refresh_reutilizado"]) {
    ok(acciones.includes(a), `registra ${a}`);
  }
  const textoBitacora = JSON.stringify(await AuditLog.findAll({ raw: true }));
  ok(!/Clave-|Nueva-Clave|\$2[aby]\$/.test(textoBitacora), "la bitácora no contiene contraseñas ni hashes");

  console.log(fallos ? `\n✗ ${fallos} fallo(s)` : "\n✓ Todas las pruebas pasaron");
  server.close();
  await sequelize.close();
  process.exit(fallos ? 1 : 0);
})().catch((err) => { console.error("ERROR INESPERADO", err); process.exit(1); });
