/**
 * VALIDACIÓN DE LA SOLICITUD DE EMISIÓN (POST /comprobante/emision)
 *
 * strictObject rechaza cualquier campo no declarado: el cliente NO puede
 * enviar correlativo, totales, IGV ni estado_sunat. El servidor los decide.
 */
const { z } = require("zod");

const METODOS_PAGO = ["Efectivo", "Yape", "Plin", "Tarjeta", "Transferencia"];
const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha YYYY-MM-DD");
const ID = z.coerce.number().int().positive();

const item = z.strictObject({
  descripcion: z.string().trim().min(1).max(500),
  unidad_id: z.string().trim().min(1).max(10).default("NIU"),
  cantidad: z.coerce.number().positive().max(1_000_000),
  // Precio unitario CON IGV, tal como se cobra al cliente.
  precio_unitario: z.coerce.number().positive().max(10_000_000),
  producto_id: ID.nullish(),
});

const cliente = z.strictObject({
  // Catálogo 06 SUNAT: 0=sin documento, 1=DNI, 4=carné extranjería, 6=RUC, 7=pasaporte
  tipo_documento_id: z.enum(["0", "1", "4", "6", "7", "A"]),
  nrodoc: z.string().trim().max(15).default(""),
  razon_social: z.string().trim().max(200).default(""),
  direccion: z.string().trim().max(200).nullish(),
});

const nota = z.strictObject({
  comprobante_ref_id: ID,
  tipo_nota_id: z.string().trim().min(2).max(4), // catálogo 09 (NC)
  descripcion_nota: z.string().trim().min(3).max(250),
});

const emisionSchema = z
  .strictObject({
    tipo_comprobante_id: z.enum(["01", "03", "07"]),
    emisor_id: ID,
    serie_id: ID,
    fecha_emision: FECHA.optional(),
    forma_pago: z.enum(["Contado", "Crédito"]).default("Contado"),
    fecha_vencimiento: FECHA.nullish(),
    metodo_pago: z.enum(METODOS_PAGO).default("Efectivo"),
    cliente: cliente.nullish(),
    items: z.array(item).min(1).max(200),
    nota: nota.nullish(),
  })
  .superRefine((d, ctx) => {
    const issue = (path, message) => ctx.addIssue({ code: "custom", path, message });

    if (d.forma_pago === "Crédito") {
      if (!d.fecha_vencimiento) issue(["fecha_vencimiento"], "Requerida para pago a crédito");
      else if (d.fecha_emision && d.fecha_vencimiento <= d.fecha_emision) {
        issue(["fecha_vencimiento"], "Debe ser posterior a la fecha de emisión");
      }
    }
    if (d.tipo_comprobante_id === "01") {
      if (!d.cliente || d.cliente.tipo_documento_id !== "6" || !/^\d{11}$/.test(d.cliente.nrodoc)) {
        issue(["cliente"], "La factura requiere RUC del cliente (11 dígitos)");
      } else if (!d.cliente.razon_social) {
        issue(["cliente", "razon_social"], "La factura requiere la razón social");
      }
    }
    if (d.cliente && d.cliente.tipo_documento_id === "1" && !/^\d{8}$/.test(d.cliente.nrodoc)) {
      issue(["cliente", "nrodoc"], "El DNI debe tener 8 dígitos");
    }
    if (d.tipo_comprobante_id === "07" && !d.nota) issue(["nota"], "La nota de crédito requiere el documento de referencia");
    if (d.tipo_comprobante_id !== "07" && d.nota) issue(["nota"], "Solo aplica a notas de crédito");
  });

/** Convierte un ZodError en un mensaje legible ("campo: motivo; ..."). */
const mensajeError = (error) =>
  error.issues.map((i) => `${i.path.join(".") || "solicitud"}: ${i.message}`).join("; ");

module.exports = { emisionSchema, mensajeError, METODOS_PAGO };
