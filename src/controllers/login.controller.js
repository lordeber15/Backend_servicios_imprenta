/**
 * CONTROLADOR DE AUTENTICACIÓN Y USUARIOS
 * 
 * Este controlador maneja toda la lógica de autenticación y gestión de usuarios.
 * 
 * Funcionalidades:
 * - Autenticación con JWT (JSON Web Tokens)
 * - Hash de contraseñas con bcrypt
 * - CRUD de usuarios (Create, Read, Update, Delete)
 * - Migración automática de contraseñas en texto plano a hash
 * 
 * Dependencias:
 * - bcryptjs: Hash y comparación de contraseñas
 * - jsonwebtoken: Generación y verificación de tokens JWT
 * - Login model: Modelo de Sequelize para usuarios
 */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Login } = require("../models/login");

/**
 * Obtener todos los usuarios
 * 
 * Retorna la lista de usuarios registrados en el sistema.
 * NO retorna las contraseñas por seguridad.
 * 
 * Ruta: GET /login
 * Autenticación: Requerida (JWT)
 * 
 * @param {Object} _req - Request (no usado, por eso el prefijo _)
 * @param {Object} res - Response
 * @returns {Array} Lista de usuarios sin contraseñas
 * 
 * Respuesta exitosa (200):
 * [
 *   { id: 1, usuario: "admin", cargo: "Administrador" },
 *   { id: 2, usuario: "usuario1", cargo: "Usuario" }
 * ]
 */
const getLogin = async (_req, res) => {
  try {
    // Buscar todos los usuarios ACTIVOS, excluyendo el campo password
    const users = await Login.findAll({ 
      where: { activo: true },
      attributes: ["id", "usuario", "cargo", "image_url"] 
    });
    res.json(users);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Autenticar usuario (Login)
 * 
 * Valida las credenciales del usuario y genera un token JWT si son correctas.
 * 
 * Ruta: POST /auth/login
 * Autenticación: No requerida (ruta pública)
 * 
 * @param {Object} req - Request
 * @param {string} req.body.usuario - Nombre de usuario
 * @param {string} req.body.password - Contraseña
 * @param {Object} res - Response
 * @returns {Object} Token JWT y datos del usuario
 * 
 * Respuesta exitosa (200):
 * {
 *   token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   id: 1,
 *   usuario: "admin",
 *   cargo: "Administrador"
 * }
 * 
 * Errores:
 * - 400: Faltan usuario o contraseña
 * - 401: Credenciales incorrectas
 * - 500: Error del servidor
 */
const authLogin = async (req, res) => {
  try {
    const { usuario, password } = req.body;

    // Validar que se envíen ambos campos
    if (!usuario || !password) {
      return res.status(400).json({ message: "Usuario y contraseña son requeridos" });
    }

    // Buscar usuario en la base de datos
    const user = await Login.findOne({ where: { usuario } });
    if (!user) {
      return res.status(401).json({ message: "Usuario o contraseña incorrectos" });
    }

    // Verificar si el usuario está activo (Eliminación Lógica)
    if (!user.activo) {
      return res.status(403).json({ message: "Tu cuenta ha sido desactivada. Contacta al administrador." });
    }

    /**
     * VERIFICACIÓN DE CONTRASEÑA
     * 
     * bcrypt.compare() compara la contraseña en texto plano
     * con el hash almacenado en la base de datos.
     */
    let passwordValid = await bcrypt.compare(password, user.password);

    /**
     * MIGRACIÓN AUTOMÁTICA DE CONTRASEÑAS
     * 
     * Si la contraseña aún está en texto plano (legacy),
     * se hashea automáticamente en el primer login.
     * 
     * Esto permite migrar gradualmente de texto plano a hash
     * sin resetear todas las contraseñas.
     */
    if (!passwordValid && password === user.password) {
      // Contraseña en texto plano detectada → Hashear
      user.password = await bcrypt.hash(password, 10);
      await user.save();
      passwordValid = true;
    }

    // Si la contraseña sigue siendo inválida, rechazar
    if (!passwordValid) {
      return res.status(401).json({ message: "Usuario o contraseña incorrectos" });
    }

    /**
     * GENERACIÓN DE TOKEN JWT
     * 
     * jwt.sign(payload, secret, options)
     * - payload: Datos que se incluyen en el token (id, usuario, cargo)
     * - secret: Clave secreta desde .env (JWT_SECRET)
     * - expiresIn: Tiempo de expiración del token (8 horas)
     * 
     * El token se envía al frontend y se incluye en cada petición
     * para verificar la autenticación.
     */
    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, cargo: user.cargo, image_url: user.image_url },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    // Retornar token y datos del usuario (sin contraseña)
    res.json({ token, id: user.id, usuario: user.usuario, cargo: user.cargo, image_url: user.image_url });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Crear nuevo usuario
 * 
 * Registra un nuevo usuario en el sistema con contraseña hasheada.
 * 
 * Ruta: POST /login
 * Autenticación: Requerida (JWT)
 * Rol: Solo Administrador
 * 
 * @param {Object} req - Request
 * @param {string} req.body.usuario - Nombre de usuario
 * @param {string} req.body.password - Contraseña en texto plano
 * @param {string} req.body.cargo - Rol (Administrador, Usuario)
 * @param {Object} res - Response
 * @returns {Object} Datos del usuario creado (sin contraseña)
 * 
 * Respuesta exitosa (200):
 * {
 *   id: 3,
 *   usuario: "nuevo_usuario",
 *   cargo: "Usuario"
 * }
 */
const createLogin = async (req, res) => {
  try {
    const { usuario, password, cargo } = req.body;
    
    /**
     * HASH DE CONTRASEÑA
     * 
     * bcrypt.hash(password, saltRounds)
     * - password: Contraseña en texto plano
     * - saltRounds: 10 (número de rondas de hash, más = más seguro pero más lento)
     * 
     * NUNCA almacenar contraseñas en texto plano.
     */
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Crear usuario con contraseña hasheada
    const newLogin = await Login.create({ usuario, password: hashedPassword, cargo });
    
    // Retornar datos sin contraseña
    res.json({ id: newLogin.id, usuario: newLogin.usuario, cargo: newLogin.cargo });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Eliminar usuario
 * 
 * Elimina un usuario del sistema.
 * 
 * Ruta: DELETE /login/:id
 * Autenticación: Requerida (JWT)
 * Rol: Solo Administrador
 * 
 * @param {Object} req - Request
 * @param {string} req.params.id - ID del usuario a eliminar
 * @param {Object} res - Response
 * @returns {Object} Mensaje de confirmación
 * 
 * Respuesta exitosa (200):
 * { message: "Usuario eliminado correctamente" }
 * 
 * Errores:
 * - 404: Usuario no encontrado
 * - 500: Error del servidor
 */
const deleteLogin = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar usuario por ID
    const login = await Login.findByPk(id);
    if (!login) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    
    /**
     * ELIMINACIÓN LÓGICA
     * 
     * En lugar de borrar físicamente el registro (destroy),
     * cambiamos el estado 'activo' a false.
     * Esto mantiene la integridad referencial en el sistema.
     */
    login.activo = false;
    await login.save();

    res.json({ message: "Usuario desactivado correctamente (Baja lógica)" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Actualizar usuario
 * 
 * Actualiza los datos de un usuario existente.
 * Si se envía una nueva contraseña, se hashea antes de guardar.
 * 
 * Ruta: PUT /login/:id
 * Autenticación: Requerida (JWT)
 * Rol: Solo Administrador
 * 
 * @param {Object} req - Request
 * @param {string} req.params.id - ID del usuario a actualizar
 * @param {string} [req.body.usuario] - Nuevo nombre de usuario
 * @param {string} [req.body.password] - Nueva contraseña (opcional)
 * @param {string} [req.body.cargo] - Nuevo rol
 * @param {Object} res - Response
 * @returns {Object} Datos del usuario actualizado (sin contraseña)
 * 
 * Respuesta exitosa (200):
 * {
 *   id: 1,
 *   usuario: "admin_actualizado",
 *   cargo: "Administrador"
 * }
 * 
 * Errores:
 * - 404: Usuario no encontrado
 * - 500: Error del servidor
 */
const updateLogin = async (req, res) => {
  try {
    const { id } = req.params;
    const { usuario, password, confirmPassword, cargo, activo } = req.body;
    
    // Buscar usuario por ID
    const userUpdate = await Login.findByPk(id);
    if (!userUpdate) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    
    // Actualizar nombre de usuario si se proporciona
    if (usuario) userUpdate.usuario = usuario;
    
    /**
     * ACTUALIZACIÓN DE CONTRASEÑA CON SEGURIDAD REFORZADA
     * 
     * Se requiere 'password' y 'confirmPassword'.
     * Deben ser idénticos para proceder.
     */
    if (password) {
      if (password !== confirmPassword) {
        return res.status(400).json({ message: "Las contraseñas no coinciden" });
      }
      userUpdate.password = await bcrypt.hash(password, 10);
    }
    
    // Actualizar cargo y estado si se proporcionan
    if (cargo) userUpdate.cargo = cargo;
    if (activo !== undefined) userUpdate.activo = activo;
    
    // Guardar cambios
    await userUpdate.save();
    
    res.json({ 
      id: userUpdate.id, 
      usuario: userUpdate.usuario, 
      cargo: userUpdate.cargo, 
      activo: userUpdate.activo 
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Exportar todas las funciones del controlador
module.exports = { getLogin, authLogin, createLogin, deleteLogin, updateLogin };
