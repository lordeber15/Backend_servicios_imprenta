// PDFs reales con puppeteer-core + Chromium del sistema (comprobante A4,
// ticket 80 mm y ticket de venta). Valida el cambio a puppeteer-core 25.
const bcrypt = require("bcryptjs");
const app = require("/app/src/infrastructure/web/app");
const sequelize = require("/app/src/infrastructure/database/database");
const { Login } = require("/app/src/infrastructure/database/models/login");
const { emisionSchema } = require("/app/src/application/validation/emision.schema");
const { emitir } = require("/app/src/application/services/emision.service");
const { closeBrowser } = require("/app/src/infrastructure/external_services/browserPool");

let fallos = 0;
const ok = (cond, msg) => { console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`); if (!cond) fallos++; };
const CLAVE = ["Clave", "Pdf", "2026"].join("-");

(async () => {
  await sequelize.query(`
    INSERT INTO "TipoComprobante" (id, descripcion) VALUES ('03','Boleta');
    INSERT INTO "TipoDocumento" (id, descripcion) VALUES ('0','Sin doc'),('1','DNI');
    INSERT INTO "Moneda" (id, descripcion) VALUES ('PEN','Soles');
    INSERT INTO "Emisor" (id, ruc, razon_social, direccion) VALUES (1,'20000000001','EMISOR <b>PRUEBA</b>','Av. X');
    INSERT INTO "Serie" (id, tipo_comprobante_id, serie, correlativo) VALUES (1,'03','B001',1);
    INSERT INTO "AperturaCajas" (fecha_apertura, monto_apertura, estado, "createdAt", "updatedAt") VALUES (CURRENT_DATE, 0, 'abierta', now(), now());
  `);
  await Login.create({ id: 1, usuario: "admin", password: await bcrypt.hash(CLAVE, 4), cargo: "Administrador", activo: true });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const { access_token } = await (await fetch(`${base}/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ usuario: "admin", password: CLAVE }),
  })).json();
  const get = (ruta) => fetch(base + ruta, { headers: { authorization: `Bearer ${access_token}` } });
  const esPdf = async (r) => {
    const buf = Buffer.from(await r.arrayBuffer());
    return { status: r.status, tipo: r.headers.get("content-type"), pdf: buf.subarray(0, 5).toString() === "%PDF-", kb: Math.round(buf.length / 1024) };
  };

  const { comprobante: c } = await emitir(emisionSchema.parse({
    tipo_comprobante_id: "03", emisor_id: 1, serie_id: 1, metodo_pago: "Efectivo",
    items: [{ descripcion: "Tarjetas <script>alert(1)</script>", cantidad: 100, precio_unitario: 0.15 }],
  }));
  for (const formato of ["a4", "ticket"]) {
    const r = await esPdf(await get(`/comprobante/${c.id}/pdf?format=${formato}`));
    ok(r.status === 200 && /pdf/.test(r.tipo) && r.pdf, `PDF del comprobante (${formato}): ${r.status}, ${r.kb} KB`);
  }

  const t = await fetch(`${base}/ticket`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${access_token}` },
    body: JSON.stringify({ cliente: "Cliente", metodo_pago: "Efectivo", detalles: [{ descripcion: "Producto", cantidad: 1, precioUnitario: 10 }] }),
  }).then((x) => x.json());
  const r = await esPdf(await get(`/ticket/${t.id}/pdf`));
  ok(r.status === 200 && r.pdf, `PDF del ticket: ${r.status}, ${r.kb} KB`);

  console.log(fallos ? `\n✗ ${fallos} fallo(s)` : "\n✓ Todas las pruebas pasaron");
  server.close();
  await closeBrowser();
  await sequelize.close();
  process.exit(fallos ? 1 : 0);
})().catch((err) => { console.error("ERROR INESPERADO", err); process.exit(1); });
