// Prueba de integración de la caja (Fase 4) contra una BD aislada.
const sequelize = require("/app/src/infrastructure/database/database");
const caja = require("/app/src/infrastructure/web/controllers/caja/caja.controller");
const tickets = require("/app/src/infrastructure/web/controllers/Tickets/ticket.controller");
const ingresos = require("/app/src/infrastructure/web/controllers/ingresosyegresos/ingreso.controller");
const egresos = require("/app/src/infrastructure/web/controllers/ingresosyegresos/egreso.controller");
const { emitir } = require("/app/src/application/services/emision.service");
const { emisionSchema } = require("/app/src/application/validation/emision.schema");
const Comprobante = require("/app/src/infrastructure/database/models/facturacion/comprobante");

let fallos = 0;
const ok = (cond, msg) => { console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`); if (!cond) fallos++; };

// Invoca un controller Express y devuelve { status, body, error }
const llamar = (fn, { params = {}, body = {}, user = { id: 1, cargo: "Administrador" } } = {}) =>
  new Promise((resolve) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); } };
    fn({ params, body, query: {}, user }, res, (error) => resolve({ status: error?.statusCode || 500, error }));
  });
const boleta = (precio, metodo, extra = {}) => emisionSchema.parse({
  tipo_comprobante_id: "03", emisor_id: 1, serie_id: 1, metodo_pago: metodo,
  items: [{ descripcion: "Item", cantidad: 1, precio_unitario: precio }], ...extra,
});

(async () => {
  await sequelize.query(`
    INSERT INTO "TipoComprobante" (id, descripcion) VALUES ('01','Factura'),('03','Boleta'),('07','NC');
    INSERT INTO "TipoDocumento" (id, descripcion) VALUES ('0','Sin doc'),('1','DNI'),('6','RUC');
    INSERT INTO "Moneda" (id, descripcion) VALUES ('PEN','Soles');
    INSERT INTO "Emisor" (id, ruc, razon_social) VALUES (1,'20000000001','EMISOR PRUEBA');
    INSERT INTO "Serie" (id, tipo_comprobante_id, serie, correlativo) VALUES (1,'03','B001',1),(2,'01','F001',1),(3,'07','BC01',1);
    INSERT INTO logins (id, usuario, password, cargo, activo, "createdAt", "updatedAt") VALUES (1,'adm','x','Administrador',true,now(),now());
  `);

  console.log("1) Sin caja abierta no se vende");
  let r = await llamar(tickets.createTicket, { body: { cliente: "A", metodo_pago: "Efectivo", detalles: [{ descripcion: "X", cantidad: 1, precioUnitario: 5 }] } });
  ok(r.status === 409, `ticket sin caja → 409 (${r.error?.message})`);
  let e = await emitir(boleta(10, "Efectivo")).catch((x) => x);
  ok(e.statusCode === 409, "boleta sin caja → 409");

  console.log("2) Apertura");
  r = await llamar(caja.abrirCaja, { body: { monto_apertura: 100 } });
  ok(r.status === 200 && r.body.usuario_apertura_id === 1, "caja abierta con S/ 100 por el usuario 1");
  const cajaId = r.body.id;
  const [r2, r3] = await Promise.all([
    llamar(caja.abrirCaja, { body: { monto_apertura: 50 } }),
    llamar(caja.abrirCaja, { body: { monto_apertura: 60 } }),
  ]);
  ok(r2.status === 409 && r3.status === 409, "aperturas simultáneas adicionales → 409 (índice único)");

  console.log("3) Movimientos");
  // Ticket: producto 2 × 10 = 20 + servicio de 100 con adelanto 30 → se cobran 50 en efectivo
  r = await llamar(tickets.createTicket, { body: {
    cliente: "Cliente", metodo_pago: "Efectivo", precioTotal: 9999, // el servidor lo ignora
    detalles: [
      { descripcion: "Producto", cantidad: 2, precioUnitario: 10 },
      { descripcion: "Diseño", cantidad: 1, precioUnitario: 100, es_servicio: true, adelanto: 30 },
    ] } });
  if (r.status !== 200) console.log("    error:", r.error?.name, r.error?.message, r.error?.errors?.map((x) => x.message));
  ok(r.status === 200 && Number(r.body?.precioTotal) === 120 && Number(r.body.monto_cobrado) === 50,
    `ticket: total 120, cobrado 50 (ignora precioTotal=9999) → ${r.body?.precioTotal} / ${r.body?.monto_cobrado}`);
  const ticketId = r.body.id;
  await llamar(tickets.createTicket, { body: { cliente: "B", metodo_pago: "Yape", detalles: [{ descripcion: "X", cantidad: 1, precioUnitario: 15 }] } });

  const b1 = await emitir(boleta(40, "Efectivo"));                         // efectivo 40
  await emitir(boleta(25, "Yape"));                                         // yape 25
  const b3 = await emitir(boleta(12, "Efectivo"));                          // efectivo 12, quedará RECHAZADO
  await Comprobante.update({ estado_sunat: "ACEPTADO" }, { where: { id: b1.comprobante.id } });
  await Comprobante.update({ estado_sunat: "RECHAZADO" }, { where: { id: b3.comprobante.id } });
  await emitir(emisionSchema.parse({                                         // factura crédito 200: no entra al cajón
    tipo_comprobante_id: "01", emisor_id: 1, serie_id: 2, forma_pago: "Crédito", fecha_vencimiento: "2099-01-01",
    cliente: { tipo_documento_id: "6", nrodoc: "20123456789", razon_social: "CLI SAC" },
    items: [{ descripcion: "Libros", cantidad: 1, precio_unitario: 200 }],
  }));
  await emitir(emisionSchema.parse({                                         // NC efectivo 10 sobre b1: se devuelve
    tipo_comprobante_id: "07", emisor_id: 1, serie_id: 3,
    nota: { comprobante_ref_id: b1.comprobante.id, tipo_nota_id: "07", descripcion_nota: "Devolución" },
    items: [{ descripcion: "Item", cantidad: 1, precio_unitario: 10 }],
  }));
  await llamar(ingresos.createIngreso, { body: { monto: 8, descripcion: "Saldo trabajo", fecha: new Date(), metodo: "efectivo" } });
  await llamar(egresos.createEgresos, { body: { monto: 5, descripcion: "Taxi", fecha: new Date(), metodo: "efectivo" } });

  console.log("4) Desglose en vivo");
  r = await llamar(caja.getCajaActual);
  const d = r.body.desglose;
  // Efectivo: ticket 50 + boletas 40 + 12 − NC 10 + ingreso 8 − egreso 5 = 95
  ok(d.por_metodo.Efectivo.neto === 95, `efectivo neto 95 → ${d.por_metodo.Efectivo.neto}`);
  ok(d.por_metodo.Yape.neto === 40, `yape neto 40 (ticket 15 + boleta 25) → ${d.por_metodo.Yape.neto}`);
  ok(d.credito.neto === 200, `crédito 200 fuera del cajón → ${d.credito.neto}`);
  ok(r.body.efectivo_esperado === 195, `efectivo esperado = 100 + 95 = 195 → ${r.body.efectivo_esperado}`);
  ok(d.sunat_pendientes.cantidad === 4 && d.sunat_pendientes.por_estado.RECHAZADO?.cantidad === 1,
    `pendientes SUNAT listados (incluye el RECHAZADO) → ${JSON.stringify(d.sunat_pendientes.por_estado)}`);

  console.log("5) Cierre");
  r = await llamar(caja.cerrarCaja, { params: { id: cajaId }, body: { monto_cierre_fisico: 193 } });
  ok(r.status === 200 && r.body.diferencia === -2, `cierre con 193 contados → faltante 2 (diferencia ${r.body.diferencia})`);
  ok(r.body.caja.usuario_cierre_id === 1 && r.body.caja.desglose?.por_metodo?.Efectivo?.neto === 95, "cierre registra usuario y desglose congelado");
  r = await llamar(caja.cerrarCaja, { params: { id: cajaId }, body: { monto_cierre_fisico: 1 } });
  ok(r.status === 400, "no se puede cerrar dos veces");

  console.log("6) Caja cerrada inmutable");
  r = await llamar(tickets.deleteTicket, { params: { id: ticketId } });
  ok(r.status === 409, `borrar ticket de caja cerrada → 409 (${r.error?.message})`);
  r = await llamar(tickets.createTicket, { body: { cliente: "C", metodo_pago: "Efectivo", detalles: [{ descripcion: "X", cantidad: 1, precioUnitario: 5 }] } });
  ok(r.status === 409, "venta tras el cierre → 409");
  r = await llamar(tickets.createTicket, { body: { cliente: "C", metodo_pago: "Bitcoin", detalles: [{ descripcion: "X", cantidad: 1, precioUnitario: 5 }] } });
  ok(r.status === 400, "método de pago inválido → 400");

  console.log(fallos ? `\n✗ ${fallos} fallo(s)` : "\n✓ Todas las pruebas pasaron");
  await sequelize.close();
  process.exit(fallos ? 1 : 0);
})().catch((err) => { console.error("ERROR INESPERADO", err); process.exit(1); });
