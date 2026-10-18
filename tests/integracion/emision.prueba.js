// Prueba de integración de emision.service contra una BD de prueba aislada.
// Se ejecuta dentro del contenedor backend con DB_NAME=imprenta_migr_test y un Redis temporal.
const sequelize = require("/app/src/infrastructure/database/database");
const { emisionSchema } = require("/app/src/application/validation/emision.schema");
const { emitir } = require("/app/src/application/services/emision.service");
const { cargarEditable } = require("/app/src/infrastructure/web/controllers/facturacion/comprobante.controller");
const Comprobante = require("/app/src/infrastructure/database/models/facturacion/comprobante");
const Detalle = require("/app/src/infrastructure/database/models/facturacion/detalles");
const Serie = require("/app/src/infrastructure/database/models/facturacion/serie");
const { hoyLocal } = require("/app/src/infrastructure/utils/fecha");

let fallos = 0;
const ok = (cond, msg) => { console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`); if (!cond) fallos++; };
const parse = (d) => { const r = emisionSchema.safeParse(d); if (!r.success) throw Object.assign(new Error(r.error.issues.map(i => i.message).join("; ")), { statusCode: 400 }); return r.data; };
const espera = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };

const boleta = (extra = {}) => ({
  tipo_comprobante_id: "03", emisor_id: 1, serie_id: 1, metodo_pago: "Efectivo",
  items: [{ descripcion: "Tarjetas", cantidad: 100, precio_unitario: 0.15 }], ...extra,
});

(async () => {
  await sequelize.query(`
    INSERT INTO "TipoComprobante" (id, descripcion) VALUES ('01','Factura'),('03','Boleta'),('07','NC');
    INSERT INTO "TipoDocumento" (id, descripcion) VALUES ('0','Sin doc'),('1','DNI'),('6','RUC');
    INSERT INTO "Moneda" (id, descripcion) VALUES ('PEN','Soles');
    INSERT INTO "Emisor" (id, ruc, razon_social, direccion) VALUES (1,'20000000001','EMISOR PRUEBA','Av. X');
    INSERT INTO "Serie" (id, tipo_comprobante_id, serie, correlativo) VALUES
      (1,'03','B001',1),(2,'01','F001',1),(3,'07','FC01',1),(4,'07','BC01',1);
    INSERT INTO "AperturaCajas" (fecha_apertura, monto_apertura, estado, "createdAt", "updatedAt")
      VALUES (CURRENT_DATE, 0, 'abierta', now(), now());
  `);

  console.log("1) 20 emisiones concurrentes en la misma serie");
  const res = await Promise.all(Array.from({ length: 20 }, () => emitir(parse(boleta()))));
  const nums = res.map((r) => r.comprobante.correlativo).sort((a, b) => a - b);
  ok(new Set(nums).size === 20, `20 correlativos distintos: ${nums.join(",")}`);
  ok(nums[0] === 1 && nums[19] === 20, "consecutivos del 1 al 20");
  ok((await Serie.findByPk(1)).correlativo === 21, "la serie quedó en 21");
  ok(res.every((r) => r.firmado), "todos firmados y encolados");

  console.log("2) Montos calculados por el servidor");
  const c1 = await Comprobante.findByPk(res[0].comprobante.id, { include: [Detalle] });
  ok(Number(c1.total) === 15 && Number(c1.op_gravadas) === 12.71 && Number(c1.igv) === 2.29, `total 15.00 = 12.71 + 2.29 (obtenido ${c1.op_gravadas} + ${c1.igv} = ${c1.total})`);
  ok(Number(c1.Detalles[0].igv) === 2.29, `IGV de la LÍNEA (no de una unidad): ${c1.Detalles[0].igv}`);

  console.log("3) Validaciones de entrada");
  let e = await espera(() => emitir(parse(boleta({ correlativo: 999 }))));
  ok(e && /Unrecognized key/i.test(e.message), `rechaza correlativo enviado por el cliente (${e?.message})`);
  e = await espera(() => emitir(parse(boleta({ total: 1 }))));
  ok(e && /Unrecognized key/i.test(e.message), "rechaza total enviado por el cliente");
  e = await espera(() => emitir(parse({ ...boleta(), tipo_comprobante_id: "01", serie_id: 2 })));
  ok(e && /RUC/.test(e.message), `factura sin RUC: ${e?.message}`);
  e = await espera(() => emitir(parse(boleta({ items: [{ descripcion: "X", cantidad: 1, precio_unitario: 800 }] }))));
  ok(e && /700/.test(e.message), `boleta > 700 sin documento: ${e?.message}`);
  e = await espera(() => emitir(parse(boleta({ serie_id: 2 }))));
  ok(e && /no corresponde/.test(e.message), `serie de otro tipo: ${e?.message}`);
  e = await espera(() => emitir(parse(boleta({ fecha_emision: "2020-01-01" }))));
  ok(e && /plazo de envío/.test(e.message), `fecha fuera de plazo: ${e?.message}`);

  console.log("4) Rollback: un error a mitad de la transacción no deja nada");
  const antes = await Comprobante.count();
  e = await espera(() => emitir(parse(boleta({ items: [{ descripcion: "X", cantidad: 1, precio_unitario: 5, producto_id: 99999 }] }))));
  ok(!!e, `falla por producto inexistente (${e?.name})`);
  ok((await Comprobante.count()) === antes, "no quedó cabecera huérfana");
  ok((await Serie.findByPk(1)).correlativo === 21, "la serie no avanzó");

  console.log("5) Factura y nota de crédito");
  const f = await emitir(parse({
    tipo_comprobante_id: "01", emisor_id: 1, serie_id: 2, forma_pago: "Crédito",
    fecha_emision: hoyLocal(), fecha_vencimiento: "2099-12-31",
    cliente: { tipo_documento_id: "6", nrodoc: "20123456789", razon_social: "CLIENTE SAC" },
    items: [{ descripcion: "Libros", cantidad: 2, precio_unitario: 59.9 }],
  }));
  ok(f.comprobante.serie === "F001" && f.comprobante.correlativo === 1, "factura F001-1 a crédito");
  const nc = (extra) => parse({ tipo_comprobante_id: "07", emisor_id: 1, serie_id: 3,
    nota: { comprobante_ref_id: f.comprobante.id, tipo_nota_id: "01", descripcion_nota: "Anulación" },
    items: [{ descripcion: "Libros", cantidad: 1, precio_unitario: 59.9 }], ...extra });
  e = await espera(() => emitir(nc()));
  ok(e && /no está aceptado/.test(e.message), "NC sobre factura no aceptada → rechazada");
  await Comprobante.update({ estado_sunat: "ACEPTADO" }, { where: { id: f.comprobante.id } });
  e = await espera(() => emitir(nc({ serie_id: 4 })));
  ok(e && /empiece con "F"/.test(e.message), `NC con serie B sobre factura: ${e?.message}`);
  const n1 = await emitir(nc());
  ok(n1.comprobante.comprobante_ref_id === f.comprobante.id && n1.comprobante.cliente_id === f.comprobante.cliente_id, "NC válida, mismo cliente que la factura");
  e = await espera(() => emitir(nc({ items: [{ descripcion: "Libros", cantidad: 2, precio_unitario: 59.9 }] })));
  ok(e && /supera el saldo/.test(e.message), `NC que excede el saldo: ${e?.message}`);

  console.log("6) Inmutabilidad");
  await Comprobante.update({ estado_sunat: "GENERADO" }, { where: { id: res[1].comprobante.id } });
  ok(!(await espera(() => cargarEditable(res[1].comprobante.id))), "GENERADO es editable");
  e = await espera(() => cargarEditable(f.comprobante.id));
  ok(e && e.statusCode === 409, `ACEPTADO → 409: ${e?.message?.slice(0, 60)}…`);

  console.log(fallos ? `\n✗ ${fallos} fallo(s)` : "\n✓ Todas las pruebas pasaron");
  await sequelize.close();
  process.exit(fallos ? 1 : 0);
})().catch((err) => { console.error("ERROR INESPERADO", err); process.exit(1); });
