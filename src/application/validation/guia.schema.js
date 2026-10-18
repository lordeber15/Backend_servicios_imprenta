/**
 * VALIDACIÓN DE LA EMISIÓN DE GUÍAS (POST /guia/emision)
 *
 * Cabecera + ítems en una sola solicitud (antes: /guia, N× /guia/detalle y
 * /guia/emitir sin transacción, que podía dejar guías numeradas sin ítems).
 * strictObject: serie, correlativo y estados los decide el servidor.
 */
const { z } = require("zod");

const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha YYYY-MM-DD");
const ID = z.coerce.number().int().positive();
const texto = (max) => z.string().trim().max(max);
const nulo = (s) => s.nullish().transform((v) => (v === "" ? null : v ?? null));
const UBIGEO = z.string().trim().regex(/^\d{6}$/, "Ubigeo de 6 dígitos");

const item = z.strictObject({
  item: z.coerce.number().int().positive().optional(),
  descripcion: texto(500).min(1, "Cada ítem requiere descripción"),
  unidad_id: texto(3).min(1).default("NIU"),
  cantidad: z.coerce.number().positive().max(1_000_000_000),
  codigo_sunat: nulo(texto(12)),
  numero_serie: nulo(texto(50)),
});

const guiaEmisionSchema = z.strictObject({
  emisor_id: ID,
  tipo_guia: z.enum(["09", "31"]),
  serie_id: ID,
  serie: z.string().optional(), // la manda el formulario; se ignora (la decide serie_id)
  fecha_emision: FECHA,
  fecha_traslado: FECHA,
  destinatario_id: ID.nullish(),
  comprobante_rel_id: ID.nullish(),
  motivo_traslado_id: texto(2).min(1),
  descripcion_motivo: nulo(texto(250)),
  indicador_transborde: z.boolean().optional(),
  peso_bruto_total: z.coerce.number().positive().max(1e9),
  unidad_peso_id: z.enum(["KGM", "TNE"]),
  numero_bultos: z.coerce.number().int().nonnegative().max(1e6).nullish(),
  numero_contenedor: nulo(texto(20)),
  codigo_puerto: nulo(texto(10)),
  modalidad_traslado: z.enum(["01", "02"]),
  ubigeo_partida: UBIGEO,
  direccion_partida: texto(200).min(1),
  ubigeo_llegada: UBIGEO,
  direccion_llegada: texto(200).min(1),
  transportista_ruc: nulo(z.string().trim().regex(/^(\d{11})?$/, "RUC del transportista de 11 dígitos")),
  transportista_razon_social: nulo(texto(100)),
  mtc_numero: nulo(texto(20)),
  vehiculo_placa: nulo(texto(10)),
  conductor_tipo_doc: nulo(texto(1)),
  conductor_nrodoc: nulo(texto(15)),
  conductor_nombres: nulo(texto(100)),
  conductor_licencia: nulo(texto(20)),
  // Los envía el formulario de guía transportista (31) pero el modelo no los
  // guarda todavía (pendiente: el XML 31 aún no incluye al remitente).
  remitente_nrodoc: texto(15).nullish(),
  remitente_razon_social: texto(200).nullish(),
  doc_referencia_serie: texto(10).nullish(),
  doc_referencia_correlativo: texto(20).nullish(),
  items: z.array(item).min(1, "La guía necesita al menos un ítem").max(500),
}).superRefine((g, ctx) => {
  if (g.fecha_traslado < g.fecha_emision) {
    ctx.addIssue({ code: "custom", path: ["fecha_traslado"], message: "La fecha de traslado no puede ser anterior a la emisión" });
  }
  if (g.modalidad_traslado === "01" && !g.transportista_ruc) {
    ctx.addIssue({ code: "custom", path: ["transportista_ruc"], message: "El traslado público requiere el RUC del transportista" });
  }
  if (g.modalidad_traslado === "02" && (!g.vehiculo_placa || !g.conductor_nrodoc)) {
    ctx.addIssue({ code: "custom", path: ["vehiculo_placa"], message: "El traslado privado requiere placa y documento del conductor" });
  }
});

const NO_PERSISTIDOS = ["serie", "items", "remitente_nrodoc", "remitente_razon_social", "doc_referencia_serie", "doc_referencia_correlativo"];

module.exports = { guiaEmisionSchema, NO_PERSISTIDOS };
