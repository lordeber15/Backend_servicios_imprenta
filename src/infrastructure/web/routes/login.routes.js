/**
 * @swagger
 * tags:
 *   name: Autenticación
 *   description: Endpoints para el manejo de sesiones y usuarios
 */

const { Router } = require("express");
const {
  getLogin,
  authLogin,
  createLogin,
  deleteLogin,
  updateLogin,
} = require("../controllers/login.controller");
const authenticate = require("../middleware/auth.middleware");
const multer = require("multer");
const path = require("path");
const { Login } = require("../../database/models/login");

// Configuración de Multer para fotos de perfil
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "src/uploads/profiles/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `profile-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) return cb(null, true);
    cb(new Error("Solo se permiten imágenes (jpeg, jpg, png, webp)"));
  },
});

// Crear instancia del router de Express
const router = Router();

/**
 * RUTA PÚBLICA: Autenticación
 * 
 * POST /auth/login
 * 
 * Esta ruta NO requiere autenticación (es pública).
 * Permite que los usuarios inicien sesión y obtengan un token JWT.
 * 
 * Body:
 * {
 *   "usuario": "admin",
 *   "password": "123456"
 * }
 * 
 * Respuesta:
 * {
 *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "id": 1,
 *   "usuario": "admin",
 *   "cargo": "Administrador"
 * }
 */
router.post("/auth/login", authLogin);

/**
 * RUTAS PROTEGIDAS: Gestión de usuarios
 * 
 * Todas estas rutas requieren autenticación JWT.
 * El middleware 'authenticate' verifica el token antes de ejecutar el controlador.
 * 
 * Flujo:
 * 1. Cliente envía petición con header: Authorization: Bearer <token>
 * 2. Middleware 'authenticate' verifica el token
 * 3. Si es válido, ejecuta el controlador
 * 4. Si es inválido, retorna 401 Unauthorized
 */

/**
 * @swagger
 * /login:
 *   get:
 *     summary: Listar todos los usuarios
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *   post:
 *     summary: Crear un nuevo usuario
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               usuario:
 *                 type: string
 *               password:
 *                 type: string
 *               cargo:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuario creado
 */
router.get("/login", authenticate, getLogin);
router.post("/login", authenticate, createLogin);

/**
 * @swagger
 * /login/{id}:
 *   delete:
 *     summary: Eliminar un usuario
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Usuario eliminado
 *   put:
 *     summary: Actualizar datos de un usuario
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Usuario actualizado
 */
router.delete("/login/:id", authenticate, deleteLogin);
router.put("/login/:id", authenticate, updateLogin);

/**
 * @swagger
 * /login/{id}/image:
 *   put:
 *     summary: Actualizar foto de perfil
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 */
router.put("/login/:id/image", authenticate, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No se subió ninguna imagen" });
    }
    const user = await Login.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

    // Guardar ruta relativa
    user.image_url = `/uploads/profiles/${req.file.filename}`;
    await user.save();

    res.json({ message: "Imagen actualizada con éxito", image_url: user.image_url });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Exportar router para registrar en app.js
module.exports = router;
