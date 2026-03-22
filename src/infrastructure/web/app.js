/**
 * CONFIGURACIÓN DE EXPRESS Y MIDDLEWARES
 * 
 * Este archivo configura la aplicación Express con:
 * - Middlewares globales (CORS, JSON parser, Logger)
 * - Registro de todas las rutas de la API
 * - Manejo global de errores
 * 
 * Express es el framework web minimalista para Node.js que maneja:
 * - Routing (enrutamiento de peticiones)
 * - Middlewares (funciones que procesan req/res)
 * - HTTP methods (GET, POST, PUT, DELETE)
 */

require("dotenv").config(); // Cargar variables de entorno al inicio

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const compression = require("compression");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("../../config/swagger"); // Renombrado de swaggerDocs a swaggerSpec

// ============================================
// IMPORTACIÓN DE RUTAS
// ============================================

// Rutas principales
const healthRoutes = require("./routes/health.routes");
const serviciosRoutes = require("./routes/servicios.routes");
const loginRoutes = require("./routes/login.routes");
// Rutas de facturación electrónica
const clienteRoutes = require("./routes/facturacion/cliente.routes");
const comprobanteRoutes = require("./routes/facturacion/comprobante.routes");
const cuotaRoutes = require("./routes/facturacion/cuota.routes");
const detalleRoutes = require("./routes/facturacion/detalle.routes");
const emisorRoutes = require("./routes/facturacion/emisor.routes");
const envioResumenRoutes = require("./routes/facturacion/envio_resumen.routes");
const envioResumenDetalleRoutes = require("./routes/facturacion/envio_resumen_detalle.routes");
const monedaRoutes = require("./routes/facturacion/moneda.routes");
const productoRoutes = require("./routes/facturacion/producto.routes");
const serieRoutes = require("./routes/facturacion/serie.routes");
const tablaParametricaRoutes = require("./routes/facturacion/tabla_parametrica.routes");
const tipoAfectacionRoutes = require("./routes/facturacion/tipo_afectacion.routes");
const tipoComprobanteRoutes = require("./routes/facturacion/tipo_comprobante.routes");
const tipoDocumentoRoutes = require("./routes/facturacion/tipo_documento.routes");
const unidadRoutes = require("./routes/facturacion/unidad.routes");
// Rutas de servicios externos y módulos adicionales
const apireniec = require("./routes/reniec.routes");                    // Consulta DNI RENIEC
const ingreso = require("./routes/ingresosyegresos/ingresos.routes");   // Registro de ingresos
const egreso = require("./routes/ingresosyegresos/egresos.routes");     // Registro de egresos
const Ticket = require("./routes/Tickets/tickets.routes");              // Tickets
const Almanaque = require("./routes/almanaque/almanaque.route");        // Almanaques
const cajaRoutes = require("./routes/caja/caja.routes");               // Caja POS
// SUNAT — Facturación Electrónica (integración directa)
const sunatRoutes = require("./routes/facturacion/sunat.routes");
const resumenDiarioRoutes = require("./routes/facturacion/resumen_diario.routes");
const comunicacionBajaRoutes = require("./routes/facturacion/comunicacion_baja.routes");
const guiaRoutes = require("./routes/facturacion/guia.routes");
const qzRoutes = require("./routes/qz.routes"); // Rutas para QZ Tray
const formatosRoutes = require("./routes/formatos.routes"); // Formatos por usuario

// ============================================
// INICIALIZACIÓN DE EXPRESS
// ============================================
const app = express();

// ============================================
// CONFIGURACIÓN DE MIDDLEWARES GLOBALES
// ============================================

/**
 * MIDDLEWARE: Compression
 * 
 * Comprime las respuestas HTTP usando Gzip para reducir el tamaño de los datos transferidos.
 */
app.use(compression());
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

/**
 * MIDDLEWARE: CORS (Cross-Origin Resource Sharing)
 *
 * Permite que el frontend (en diferente origen/puerto) haga peticiones al backend.
 *
 * Configuración completa para producción:
 * - origin: Lista de orígenes permitidos (desde .env)
 * - credentials: true → Permite envío de cookies y headers de autenticación
 * - methods: Métodos HTTP permitidos (incluye OPTIONS para preflight)
 * - allowedHeaders: Headers que el cliente puede enviar
 * - exposedHeaders: Headers que el cliente puede leer
 * - maxAge: Cachea el resultado del preflight por 24 horas
 *
 * Ejemplo .env:
 * ALLOWED_ORIGINS=http://localhost:5173,https://impalexander.store,https://www.impalexander.store,https://api.impalexander.store
 */
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map(origin => origin.trim()) || ["http://localhost:5173"];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (como apps móviles o curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS bloqueado para origen: ${origin}`);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 horas de cache para preflight
}));

// Manejar explícitamente OPTIONS para todas las rutas (preflight)
app.options('*', cors());

/**
 * MIDDLEWARE: JSON Parser
 * 
 * Parsea automáticamente el body de las peticiones con Content-Type: application/json
 * Convierte el JSON string en objeto JavaScript accesible en req.body
 */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/**
 * MIDDLEWARE: Morgan (HTTP Logger)
 * 
 * Registra todas las peticiones HTTP en consola.
 * Modo "dev": Formato colorizado para desarrollo
 * 
 * Ejemplo de log:
 * GET /servicios 200 45.123 ms - 1234
 */
app.use(morgan("dev"));

// ============================================
// DOCUMENTACIÓN DE LA API (SWAGGER)
// ============================================
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// SERVIR ARCHIVOS ESTÁTICOS (Imágenes de perfil, comprobantes, etc)
app.use("/uploads", express.static(path.join(__dirname, "../../uploads"), {
  maxAge: "1d",
  etag: true,
}));

// ============================================
// REGISTRO DE RUTAS
// ============================================

// ============================================
// REGISTRO DE RUTAS CON PREFIJO /API
// ============================================

const apiRouter = express.Router();

// Rutas principales
app.use("/health", healthRoutes); // Health check y diagnóstico CORS
app.use(serviciosRoutes);    // Órdenes de servicio/trabajos
app.use(loginRoutes);        // Autenticación y usuarios
// Rutas de facturación electrónica
app.use(clienteRoutes);
app.use(comprobanteRoutes);
app.use(cuotaRoutes);
app.use(detalleRoutes);
app.use(emisorRoutes);
app.use(envioResumenRoutes);
app.use(envioResumenDetalleRoutes);
app.use(monedaRoutes);
app.use(productoRoutes);
app.use(serieRoutes);
app.use(tablaParametricaRoutes);
app.use(tipoAfectacionRoutes);
app.use(tipoComprobanteRoutes);
app.use(tipoDocumentoRoutes);
app.use(unidadRoutes);
// Rutas de servicios externos y módulos adicionales
app.use(apireniec);          // Consulta RENIEC
app.use(ingreso);            // Ingresos
app.use(egreso);             // Egresos
app.use(Ticket);             // Tickets
app.use(Almanaque);          // Almanaques
app.use(cajaRoutes);         // Caja POS
// SUNAT — Facturación Electrónica
app.use(sunatRoutes);
app.use(resumenDiarioRoutes);
app.use(comunicacionBajaRoutes);
app.use(guiaRoutes);
app.use(formatosRoutes);       // Formatos por usuario

// Nuevas rutas con prefijo /api
app.use("/qz", qzRoutes);

// Registrar todas las rutas bajo /api
//app.use("/api", apiRouter);


// ============================================
// MANEJADOR GLOBAL DE ERRORES
// ============================================

/**
 * Middleware de manejo de errores
 * 
 * Este middleware captura todos los errores que ocurran en las rutas.
 * Debe ser el ÚLTIMO middleware registrado.
 * 
 * @param {Error} err - Objeto de error
 * @param {Object} _req - Request (no usado, por eso el prefijo _)
 * @param {Object} res - Response
 * @param {Function} _next - Next (no usado)
 * 
 * Respuesta:
 * - Status: err.status o 500 (Internal Server Error)
 * - Body: { message: "Descripción del error" }
 */
app.use((err, _req, res, _next) => {
  console.error(err.stack);

  const status = err.status || 500;
  const message = status >= 500
    ? "Error interno del servidor"
    : err.message || "Error en la solicitud";

  res.status(status).json({ message });
});

// Exportar la aplicación Express para usar en index.js
module.exports = app;
