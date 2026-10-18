/**
 * VALIDACIÓN DE USUARIOS Y POLÍTICA DE CONTRASEÑAS
 *
 * - Contraseña: 10+ caracteres, máximo 72 bytes (bcrypt ignora lo que pase de
 *   ahí: dos contraseñas distintas con el mismo inicio serían equivalentes),
 *   distinta del nombre de usuario y fuera de una lista de las más comunes.
 * - strictObject: no se aceptan campos extra (p. ej. activo o token_version
 *   en una creación).
 */
const { z } = require("zod");

const CARGOS = ["Administrador", "Usuario"];
const COMUNES = new Set([
  "1234567890", "12345678910", "0123456789", "qwertyuiop", "password12", "contraseña",
  "administrador", "imprenta123", "alexander1", "1111111111", "abcdefghij", "password123",
]);

const usuario = z.string().trim()
  .min(3, "El usuario debe tener al menos 3 caracteres")
  .max(50, "El usuario no puede pasar de 50 caracteres")
  .regex(/^[\p{L}\p{N} ._@-]+$/u, "El usuario solo admite letras, números, espacios y . _ @ -");

const password = z.string()
  .min(10, "La contraseña debe tener al menos 10 caracteres")
  .refine((p) => Buffer.byteLength(p, "utf8") <= 72, "La contraseña es demasiado larga (máximo 72 bytes)")
  .refine((p) => !COMUNES.has(p.toLowerCase()), "Esa contraseña es demasiado común");

const distintaDelUsuario = (d, ctx) => {
  if (d.password && d.usuario && d.password.toLowerCase().includes(d.usuario.toLowerCase())) {
    ctx.addIssue({ code: "custom", path: ["password"], message: "La contraseña no puede contener el nombre de usuario" });
  }
  if (d.password !== undefined && d.confirmPassword !== undefined && d.password !== d.confirmPassword) {
    ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Las contraseñas no coinciden" });
  }
};

const crearUsuarioSchema = z.strictObject({
  usuario,
  password,
  confirmPassword: z.string().optional(),
  cargo: z.enum(CARGOS),
}).superRefine(distintaDelUsuario);

// En la edición la contraseña vacía significa "no cambiarla".
const actualizarUsuarioSchema = z.strictObject({
  usuario: usuario.optional(),
  password: z.preprocess((v) => (v === "" ? undefined : v), password.optional()),
  confirmPassword: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  cargo: z.enum(CARGOS).optional(),
  activo: z.boolean().optional(),
}).superRefine(distintaDelUsuario);

const cambiarPasswordSchema = z.strictObject({
  password_actual: z.string().min(1, "Ingrese su contraseña actual").max(200),
  password_nueva: password,
}).refine((d) => d.password_actual !== d.password_nueva, {
  path: ["password_nueva"], message: "La nueva contraseña debe ser distinta de la actual",
});

const loginSchema = z.object({
  usuario: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

module.exports = { crearUsuarioSchema, actualizarUsuarioSchema, cambiarPasswordSchema, loginSchema, CARGOS };
