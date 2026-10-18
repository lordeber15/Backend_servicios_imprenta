/**
 * @swagger
 * tags:
 *   name: Autenticación
 *   description: Endpoints para el manejo de sesiones y usuarios
 */

const { Router } = require("express");
const {
  getLogin,
  createLogin,
  deleteLogin,
  updateLogin,
} = require("../controllers/login.controller");
const authenticate = require("../middleware/auth.middleware");
const { authorize, authorizeSelfOrAdmin } = require("../middleware/authorize.middleware");
const { authLimiter, passwordLimiter, sesionLimiter } = require("../middleware/rateLimit.middleware");
const auth = require("../controllers/auth.controller");
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
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
 * RUTAS DE SESIÓN (públicas: no exigen access token)
 *
 * POST /auth/login    { usuario, password } → { access_token, expires_in, usuario }
 *                     + cookie httpOnly con el refresh token (Path=/auth).
 * POST /auth/refresh  Con la cookie: rota el refresh y devuelve un access token nuevo.
 * POST /auth/logout   Revoca el refresh y borra la cookie.
 *
 * refresh y logout actúan con la cookie, así que exigen un Origin permitido
 * (defensa CSRF además de SameSite=Strict).
 */
router.post("/auth/login", authLimiter, auth.login);
router.post("/auth/refresh", sesionLimiter, auth.exigirOrigen, auth.refresh);
router.post("/auth/logout", sesionLimiter, auth.exigirOrigen, auth.logout);

/**
 * PUT /auth/password — cambiar la contraseña propia (requiere la actual).
 * Cualquier usuario autenticado; cierra todas sus sesiones.
 */
router.put("/auth/password", authenticate, passwordLimiter, auth.cambiarPassword);

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
router.get("/login", authenticate, authorize("Administrador"), getLogin);
router.post("/login", authenticate, authorize("Administrador"), createLogin);

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
router.delete("/login/:id", authenticate, authorize("Administrador"), deleteLogin);
router.put("/login/:id", authenticate, authorize("Administrador"), updateLogin);

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
// Propio o admin: un usuario puede cambiar su foto, pero no la de otro.
router.put("/login/:id/image", authenticate, authorizeSelfOrAdmin("id"), upload.single("image"), async (req, res) => {
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
