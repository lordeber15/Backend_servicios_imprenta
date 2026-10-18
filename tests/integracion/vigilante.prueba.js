// Prueba de integración de la Fase 7: plazos SUNAT, vigilante, pendientes y
// health. Se ejecuta con tests/integracion/correr.sh (BD y Redis aislados,
// ningún worker consume la cola: nada llega a SUNAT).
const bcrypt = require("/app/node_modules/bcryptjs");
const app = require("/app/src/infrastructure/web/app");
const sequelize = require("/app/src/infrastructure/database/database");
const redis = require("/app/src/infrastructure/config/redis");
const Comprobante = require("/app/src/infrastructure/database/models/facturacion/comprobante");
const { Login } = require("/app/src/infrastructure/database/models/login");
const { emisionSchema } = require("/app/src/application/validation/emision.schema");
const { emitir } = require("/app/src/application/services/emision.service");
const { sunatQueue } = require("/app/src/infrastructure/queues/sunatQueue");
const { revisar, CLAVE_LATIDO } = require("/app/src/workers/vigilanteSunat");
const { pendientesSunat } = require("/app/src/application/services/pendientesSunat.service");
const plazos = require("/app/src/application/plazosSunat");
const { hoyLocal } = require("/app/src/infrastructure/utils/fecha");

const CLAVE_PRUEBA = ["Clave", "Prueba", "2026"].join("-"); // usuario ficticio de la BD temporal
let fallos = 0;
const ok = (cond, msg) => { console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`); if (!cond) fallos++; };
const hace = (dias) => plazos.sumarDias(hoyLocal(), -dias);
const estadoJob = async (id) => (await sunatQueue.getJob(`comprobante-${id}`))?.getState();

const boleta = () => emisionSchema.parse({
  tipo_comprobante_id: "03", emisor_id: 1, serie_id: 1, metodo_pago: "Efectivo",
  items: [{ descripcion: "Item", cantidad: 1, precio_unitario: 10 }],
});
const factura = () => emisionSchema.parse({
  tipo_comprobante_id: "01", emisor_id: 1, serie_id: 2, forma_pago: "Contado", metodo_pago: "Efectivo",
  cliente: { tipo_documento_id: "6", nrodoc: "20123456789", razon_social: "CLI SAC" },
  items: [{ descripcion: "Item", cantidad: 1, precio_unitario: 100 }],
});
/** Emite y deja el comprobante "perdido": sin job en la cola y con el estado/fecha indicados. */
async function perdido(datos, cambios) {
  const { comprobante: c } = await emitir(datos);
  await (await sunatQueue.getJob(`comprobante-${c.id}`))?.remove();
  await Comprobante.update(cambios, { where: { id: c.id } });
  return c;
}

(async () => {
  await sunatQueue.obliterate({ force: true });
  await sequelize.query(`
    INSERT INTO "TipoComprobante" (id, descripcion) VALUES ('01','Factura'),('03','Boleta'),('07','NC');
    INSERT INTO "TipoDocumento" (id, descripcion) VALUES ('0','Sin doc'),('1','DNI'),('6','RUC');
    INSERT INTO "Moneda" (id, descripcion) VALUES ('PEN','Soles');
    INSERT INTO "Emisor" (id, ruc, razon_social, direccion) VALUES (1,'20000000001','EMISOR PRUEBA','Av. X');
    INSERT INTO "Serie" (id, tipo_comprobante_id, serie, correlativo) VALUES (1,'03','B001',1),(2,'01','F001',1);
    INSERT INTO "AperturaCajas" (fecha_apertura, monto_apertura, estado, "createdAt", "updatedAt") VALUES (CURRENT_DATE, 0, 'abierta', now(), now());
  `);

  console.log("1) Plazos SUNAT en días calendario de Lima");
  ok(!plazos.vencido("2026-01-10", "01", "F001", "2026-01-13") && plazos.vencido("2026-01-10", "01", "F001", "2026-01-14"),
    "factura del 10: se puede enviar hasta el 13 (D+3), el 14 está vencida");
  ok(!plazos.vencido("2026-01-10", "03", "B001", "2026-01-15") && plazos.vencido("2026-01-10", "03", "B001", "2026-01-16"),
    "boleta del 10: hasta el 15 (D+5)");
  ok(plazos.plazoDias("07", "BC01") === 5 && plazos.plazoDias("07", "FC01") === 3, "NC sobre boleta (serie B) usa el plazo de boleta; sobre factura, el de factura");
  ok(plazos.diasRestantes("2026-01-10", "01", "F001", "2026-01-13") === 0, "el D+3 de una factura cuenta como 'vence hoy'");
  ok(!plazos.vencido(new Date("2026-01-10T00:00:00Z"), "01", "F001", "2026-01-13"), "acepta la fecha guardada a medianoche UTC");

  console.log("2) Vigilante");
  const errorRed = await perdido(boleta(), { estado_sunat: "ERROR_RED" });
  const sinXml = await perdido(boleta(), { estado_sunat: "GENERADO", nombre_xml: null, xml_path: null });
  const facturaVieja = await perdido(factura(), { estado_sunat: "ERROR_RED", fecha_emision: hace(4) });
  const boletaVieja = await perdido(boleta(), { estado_sunat: "ERROR_RED", fecha_emision: hace(4) });
  const agotada = await perdido(boleta(), { estado_sunat: "ERROR_RED", intentos_envio: 25 });
  const enviandoReciente = await perdido(boleta(), { estado_sunat: "ENVIANDO", enviado_at: new Date() });
  const enviandoAtascado = await perdido(boleta(), { estado_sunat: "ENVIANDO", enviado_at: new Date(Date.now() - 3600_000) });
  const yaEnCola = (await emitir(boleta())).comprobante; // conserva su job en espera
  await Comprobante.update({ estado_sunat: "ERROR_RED" }, { where: { id: yaEnCola.id } });
  const aceptado = await perdido(boleta(), { estado_sunat: "ACEPTADO" });

  const r = await revisar();
  const n = (c) => `${c.serie}-${c.correlativo}`;
  ok(r.reencolados.includes(n(errorRed)) && (await estadoJob(errorRed.id)) === "waiting", "ERROR_RED sin job → reencolado");
  ok(r.reencolados.includes(n(sinXml)) && r.regenerados === 1, "GENERADO sin XML en disco → XML regenerado y encolado");
  ok(r.fuera_plazo.includes(n(facturaVieja)) && (await Comprobante.findByPk(facturaVieja.id)).estado_sunat === "FUERA_PLAZO",
    "factura de hace 4 días → FUERA_PLAZO");
  ok(r.reencolados.includes(n(boletaVieja)), "boleta de hace 4 días sigue en plazo (5 días) → reencolada");
  ok(r.sin_reintento.includes(n(agotada)) && !(await estadoJob(agotada.id)), "con 25 intentos no se reintenta más (queda para revisión)");
  ok(!r.reencolados.includes(n(enviandoReciente)), "ENVIANDO hace segundos → no se toca");
  ok(r.reencolados.includes(n(enviandoAtascado)), "ENVIANDO hace 1 hora sin job → reencolado");
  ok(!r.reencolados.includes(n(yaEnCola)) && (await sunatQueue.getJobs(["waiting", "delayed"])).filter((j) => j.id === `comprobante-${yaEnCola.id}`).length === 1,
    "con job ya en cola → no se duplica");
  ok(!r.reencolados.includes(n(aceptado)), "ACEPTADO → no se toca");
  ok(r.errores.length === 0, `sin errores (${r.errores.join(" | ")})`);
  const r2 = await revisar();
  ok(r2.reencolados.length === 0 && r2.fuera_plazo.length === 0, "segunda pasada: nada que hacer (idempotente)");

  console.log("3) Pendientes SUNAT");
  let p = await pendientesSunat();
  const boletaViejaItem = p.pendientes.items.find((i) => i.id === boletaVieja.id);
  ok(p.pendientes.total >= 7, `pendientes listados (${p.pendientes.total}): ${JSON.stringify(p.pendientes.por_estado)}`);
  ok(boletaViejaItem?.dias_restantes === 1 && boletaViejaItem.fecha_limite === plazos.sumarDias(hace(4), 5), "cada pendiente trae su fecha límite y días restantes");
  ok(p.fuera_plazo_30_dias === 1, "fuera de plazo en 30 días: 1");
  ok(p.worker.activo === false, "sin latido → worker inactivo");
  await redis.set(CLAVE_LATIDO, String(Date.now()), "EX", 120);
  p = await pendientesSunat();
  ok(p.worker.activo === true && p.vigilante?.ultima_revision, "con latido → worker activo y última revisión del vigilante");
  ok(["ok", "por_vencer", "vencido"].includes(p.certificado.estado) && Number.isInteger(p.certificado.dias_restantes),
    `certificado: ${p.certificado.estado}, ${p.certificado.dias_restantes} días`);

  console.log("4) Endpoints");
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  await Login.create({ id: 1, usuario: "cajero", password: await bcrypt.hash(CLAVE_PRUEBA, 4), cargo: "Usuario", activo: true });
  const { access_token } = await (await fetch(`${base}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ usuario: "cajero", password: CLAVE_PRUEBA }) })).json();
  let res = await fetch(`${base}/sunat/pendientes`, { headers: { authorization: `Bearer ${access_token}` } });
  ok(res.status === 200 && (await res.json()).pendientes.total >= 7, "GET /sunat/pendientes (Usuario) → 200");
  res = await fetch(`${base}/sunat/pendientes`);
  ok(res.status === 401, "sin token → 401");
  res = await fetch(`${base}/health/ready`);
  const ready = await res.json();
  ok(res.status === 200 && ready.checks.base_de_datos === "ok" && ready.checks.redis === "ok", `GET /health/ready → 200 ${JSON.stringify(ready.checks)}`);
  ok(!/\/app|storage|\.pfx|password/i.test(JSON.stringify(ready)), "health/ready no expone rutas ni configuración");
  res = await fetch(`${base}/health/cors`);
  ok(process.env.NODE_ENV !== "production" || res.status !== 200, `health/cors deshabilitado en producción (${res.status})`);

  console.log(fallos ? `\n✗ ${fallos} fallo(s)` : "\n✓ Todas las pruebas pasaron");
  server.close();
  await sunatQueue.obliterate({ force: true });
  await sequelize.close();
  process.exit(fallos ? 1 : 0);
})().catch((err) => { console.error("ERROR INESPERADO", err); process.exit(1); });
