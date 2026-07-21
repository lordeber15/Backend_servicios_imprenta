const { Router } = require("express");
const multer = require("multer");
const path = require("path");
const Emisor = require("../../../database/models/facturacion/emisor");
const {
  getEmisor,
  createEmisor,
  deleteEmisor,
  updateEmisor,
} = require("../../controllers/facturacion/emisor.controller");
const { authorize } = require("../../middleware/authorize.middleware");
const router = Router();

// Configuración de Multer para logo de empresa
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, "src/uploads/empresa/");
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `logo-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) return cb(null, true);
    cb(new Error("Solo se permiten imágenes (jpeg, jpg, png, webp)"));
  },
});

/**
 * @swagger
 * /emisor:
 *   get:
 *     summary: Obtener datos del emisor (Empresa)
 *     tags: [Configuración]
 *     responses:
 *       200:
 *         description: Datos de la empresa configurada
 */
// GET queda para cualquier usuario autenticado: el frontend lo necesita
// para renderizar comprobantes. Las escrituras son datos fiscales → solo admin.
router.get("/emisor", getEmisor);
router.post("/emisor", authorize("Administrador"), createEmisor);

/**
 * @swagger
 * /emisor/{id}:
 *   delete:
 *     summary: Eliminar configuración de emisor
 *     tags: [Configuración]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Emisor eliminado
 */
router.delete("/emisor/:id", authorize("Administrador"), deleteEmisor);
router.put("/emisor/:id", authorize("Administrador"), updateEmisor);

// Upload logo de empresa
router.put("/emisor/:id/logo", authorize("Administrador"), upload.single("logo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No se subió ninguna imagen" });
    }
    const emisor = await Emisor.findByPk(req.params.id);
    if (!emisor) return res.status(404).json({ message: "Emisor no encontrado" });

    emisor.logo_url = `/uploads/empresa/${req.file.filename}`;
    await emisor.save();

    res.json({ message: "Logo actualizado", logo_url: emisor.logo_url });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
