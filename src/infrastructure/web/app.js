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
const cors = require("cors");
const morgan = require("morgan");
const path = require("path"); // Importar módulo 'path'
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("../../config/swagger"); // Renombrado de swaggerDocs a swaggerSpec

// ============================================
// IMPORTACIÓN DE RUTAS
// ============================================

// Rutas principales
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

// ============================================
// INICIALIZACIÓN DE EXPRESS
// ============================================
const app = express();

// ============================================
// CONFIGURACIÓN DE MIDDLEWARES GLOBALES
// ============================================

/**
 * MIDDLEWARE: CORS (Cross-Origin Resource Sharing)
 * 
 * Permite que el frontend (en diferente origen/puerto) haga peticiones al backend.
 * 
 * Configuración:
 * - origin: Lista de orígenes permitidos (desde .env o localhost:5173 por defecto)
 * - credentials: true → Permite envío de cookies y headers de autenticación
 * 
 * Ejemplo .env:
 * ALLOWED_ORIGINS=http://localhost:5173,https://impalexander.store
 */
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:5173"],
  credentials: true,
}));

/**
 * MIDDLEWARE: JSON Parser
 * 
 * Parsea automáticamente el body de las peticiones con Content-Type: application/json
 * Convierte el JSON string en objeto JavaScript accesible en req.body
 */
app.use(express.json());

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
app.use("/uploads", express.static(path.join(__dirname, "../../uploads")));

// ============================================
// REGISTRO DE RUTAS
// ============================================

// ============================================
// REGISTRO DE RUTAS CON PREFIJO /API
// ============================================

const apiRouter = express.Router();

// Rutas principales
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
  // Registrar error en consola para debugging
  console.error(err.stack);
  
  // Enviar respuesta JSON con el error
  res.status(err.status || 500).json({
    message: err.message || "Error interno del servidor",
  });
});

// Exportar la aplicación Express para usar en index.js
module.exports = app;
