/**
 * SUBIDA SEGURA DE IMÁGENES (logo de la empresa, foto de perfil)
 *
 * - El archivo se recibe en memoria (máx. 5 MB) y NO toca el disco hasta
 *   validarlo.
 * - El tipo se decide por los "magic bytes" del contenido, no por la
 *   extensión ni el mimetype que declara el navegador (ambos los controla el
 *   cliente: un HTML o SVG con script renombrado a .png pasaría ese filtro).
 * - Nombre siempre aleatorio con la extensión del tipo detectado: el nombre
 *   original nunca llega al sistema de archivos.
 * Deja en req.imagen = { filename, url }.
 */
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const multer = require("multer");
const { ValidationError } = require("../../utils/errors");

const MAX_BYTES = 5 * 1024 * 1024;

/** @returns {"jpg"|"png"|"webp"|null} */
function detectarTipo(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

/**
 * @param {object} o
 * @param {string} o.campo    nombre del campo multipart ("logo", "image")
 * @param {string} o.carpeta  subcarpeta de src/uploads ("empresa", "profiles")
 * @param {string} o.prefijo  prefijo del nombre ("logo", "profile")
 * @returns {Function[]} middlewares
 */
function subirImagen({ campo, carpeta, prefijo }) {
  const recibir = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: 1 },
  }).single(campo);

  const validarYGuardar = async (req, _res, next) => {
    try {
      if (!req.file) throw new ValidationError("No se subió ninguna imagen");
      const tipo = detectarTipo(req.file.buffer);
      if (!tipo) throw new ValidationError("Solo se permiten imágenes JPG, PNG o WEBP");
      const filename = `${prefijo}-${crypto.randomBytes(16).toString("hex")}.${tipo}`;
      const dir = path.join(__dirname, "../../../uploads", carpeta);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, filename), req.file.buffer, { flag: "wx" });
      req.imagen = { filename, url: `/uploads/${carpeta}/${filename}` };
      return next();
    } catch (err) {
      return next(err);
    }
  };

  // Errores de multer (tamaño, campo inesperado) como 400.
  const recibirConErrores = (req, res, next) =>
    recibir(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return next(new ValidationError(err.code === "LIMIT_FILE_SIZE" ? "La imagen supera 5 MB" : "Archivo no válido"));
      }
      return next(err);
    });

  return [recibirConErrores, validarYGuardar];
}

module.exports = { subirImagen, detectarTipo };
