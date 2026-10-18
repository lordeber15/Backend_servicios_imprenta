/**
 * VALIDACIÓN DE CLIENTES (POST/PUT /cliente)
 * El número de documento debe corresponder a su tipo (catálogo 06 SUNAT).
 */
const { z } = require("zod");

const FORMATO_DOC = {
  "1": [/^\d{8}$/, "El DNI debe tener 8 dígitos"],
  "6": [/^(10|15|17|20)\d{9}$/, "El RUC debe tener 11 dígitos y empezar con 10, 15, 17 o 20"],
  "4": [/^[A-Za-z0-9]{1,12}$/, "Carné de extranjería inválido"],
  "7": [/^[A-Za-z0-9]{1,12}$/, "Pasaporte inválido"],
  "A": [/^[A-Za-z0-9]{1,15}$/, "Cédula diplomática inválida"],
  "0": [/^[A-Za-z0-9-]{0,15}$/, "Documento inválido"],
};

const clienteSchema = z.strictObject({
  tipo_documento_id: z.enum(Object.keys(FORMATO_DOC)),
  nrodoc: z.string().trim().max(15),
  razon_social: z.string().trim().min(1, "La razón social o nombre es obligatorio").max(200),
  direccion: z.string().trim().max(200).nullish(),
}).superRefine((c, ctx) => {
  const [re, msg] = FORMATO_DOC[c.tipo_documento_id];
  if (!re.test(c.nrodoc)) ctx.addIssue({ code: "custom", path: ["nrodoc"], message: msg });
});

module.exports = { clienteSchema };
