/**
 * VALIDACIÓN DEL EMISOR (datos fiscales de la empresa)
 *
 * strictObject: no se aceptan id, logo_url (solo por /emisor/:id/logo) ni
 * campos desconocidos. clave_sol y client_secret se aceptan para guardarlos
 * cifrados; vacío significa "no cambiar".
 */
const { z } = require("zod");

const texto = (max) => z.string().trim().max(max);
const opcional = (max) => z.preprocess((v) => (v === null ? "" : v), texto(max)).optional();

const base = {
  tipodoc: z.string().trim().length(1).optional(),
  ruc: z.string().trim().regex(/^\d{11}$/, "El RUC debe tener 11 dígitos"),
  razon_social: texto(100).min(1, "La razón social es obligatoria"),
  nombre_comercial: opcional(100),
  direccion: opcional(100),
  pais: opcional(100),
  departamento: opcional(100),
  provincia: opcional(100),
  distrito: opcional(100),
  ubigeo: z.preprocess((v) => (v === null ? "" : v), z.string().trim().regex(/^(\d{6})?$/, "El ubigeo debe tener 6 dígitos")).optional(),
  usuario_sol: opcional(20),
  telefono: opcional(20),
  descripcion: opcional(200),
  client_id: opcional(200),
  // Secretos: se cifran (credenciales.service); nunca se devuelven.
  clave_sol: z.string().max(100).optional(),
  client_secret: z.string().max(300).optional(),
};

const crearEmisorSchema = z.strictObject(base);
const actualizarEmisorSchema = z.strictObject(base).partial();

module.exports = { crearEmisorSchema, actualizarEmisorSchema };
