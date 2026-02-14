# Backend - Sistema de Gestión Imprenta Alexander

API REST desarrollada con Node.js y Express para el sistema de gestión integral de imprenta, que incluye órdenes de servicio, facturación electrónica SUNAT, inventario, almanaques y control financiero.

---

## Stack Tecnológico

| Tecnología | Versión | Descripción |
|---|---|---|
| **Node.js** | >= 18 | Runtime de JavaScript |
| **Express** | 4.18.2 | Framework web minimalista |
| **PostgreSQL** | >= 14 | Base de datos relacional |
| **Sequelize** | 6.32.1 | ORM para PostgreSQL |
| **Axios** | 1.10.0 | Cliente HTTP para APIs externas |
| **bcryptjs** | 3.0.3 | Hash de contraseñas |
| **jsonwebtoken** | 9.0.3 | Autenticación JWT |
| **dotenv** | 17.2.4 | Variables de entorno |
| **Morgan** | 1.10.0 | Logger de peticiones HTTP |
| **CORS** | 2.8.5 | Control de orígenes cruzados |
| **Multer** | 2.0.2 | Manejo de archivos multipart |
| **Puppeteer** | 24.37.2 | Generación de PDFs |
| **QRCode** | 1.5.4 | Generación de códigos QR |
| **SOAP** | 1.6.4 | Cliente SOAP para SUNAT |
| **xml-crypto** | 6.1.2 | Firma digital XML |
| **Nodemon** | 3.0.1 | Auto-reload en desarrollo |

---

## Estructura del Proyecto

```
Backend_servicios_imprenta/
├── index.js                          # Entry point - Inicializa servidor y BD
├── package.json                      # Dependencias y scripts
├── .env                              # Variables de entorno (no commitear)
├── .env.example                      # Plantilla de variables de entorno
│
└── src/
    ├── app.js                        # Configuración Express y middlewares
    │
    ├── database/
    │   └── database.js               # Configuración Sequelize + PostgreSQL
    │
    ├── middleware/
    │   └── auth.middleware.js        # Middleware de autenticación JWT
    │
    ├── models/                       # Modelos Sequelize
    │   ├── login.js                  # Modelo de usuarios
    │   ├── servicios.js              # Modelo de órdenes de servicio
    │   ├── Tickets/                  # Modelos de tickets
    │   ├── almanaque/                # Modelos de almanaques
    │   ├── Ingresosyegresos/         # Modelos de ingresos y egresos
    │   └── facturacion/              # Modelos de facturación electrónica
    │       ├── asociation.js         # Relaciones entre modelos
    │       ├── cliente.js            # Clientes
    │       ├── comprobante.js        # Comprobantes (Boleta, Factura, etc.)
    │       ├── detalles.js           # Detalle de comprobantes
    │       ├── emisor.js             # Datos del emisor (empresa)
    │       ├── producto.js           # Productos/servicios
    │       ├── serie.js              # Series de comprobantes
    │       ├── moneda.js             # Tipos de moneda
    │       ├── unidad.js             # Unidades de medida
    │       ├── tipocomprobante.js    # Tipos de comprobante
    │       ├── tipodocumento.js      # Tipos de documento identidad
    │       ├── tipoafectacion.js     # Tipos de afectación IGV
    │       ├── tablaparametrica.js   # Códigos paramétricos SUNAT
    │       ├── cuota.js              # Cuotas de pago
    │       ├── guiaremision.js       # Guías de remisión
    │       ├── detalleguia.js        # Detalle de guías
    │       ├── comunicacionbaja.js   # Comunicaciones de baja
    │       ├── comunicacionbajadetalle.js
    │       ├── envioresumen.js       # Resúmenes diarios
    │       └── envioresumendetalle.js
    │
    ├── controllers/                  # Lógica de negocio
    │   ├── login.controller.js       # Autenticación y usuarios
    │   ├── servicios.controller.js   # Órdenes de servicio
    │   ├── reniec.controller.js      # Consulta DNI RENIEC
    │   ├── Tickets/                  # Controladores de tickets
    │   ├── almanaque/                # Controladores de almanaques
    │   ├── ingresosyegresos/         # Controladores financieros
    │   └── facturacion/              # Controladores de facturación (19 archivos)
    │       ├── cliente.controller.js
    │       ├── comprobante.controller.js
    │       ├── detalle.controller.js
    │       ├── emisor.controller.js
    │       ├── producto.controller.js
    │       ├── serie.controller.js
    │       ├── moneda.controller.js
    │       ├── unidad.controller.js
    │       ├── tipo_comprobante.controller.js
    │       ├── tipo_documento.controller.js
    │       ├── tipo_afectacion.controller.js
    │       ├── tabla_parametrica.controller.js
    │       ├── cuota.controller.js
    │       ├── guia.controller.js
    │       ├── sunat.controller.js   # Integración con SUNAT
    │       ├── resumen_diario.controller.js
    │       ├── comunicacion_baja.controller.js
    │       ├── envio_resumen.controller.js
    │       └── envio_resumen_detalle.controller.js
    │
    ├── routes/                       # Definición de rutas Express
    │   ├── login.routes.js
    │   ├── servicios.routes.js
    │   ├── reniec.routes.js
    │   ├── caja/                     # Rutas de Caja POS (NUEVO)
    │   ├── Tickets/
    │   ├── almanaque/
    │   ├── ingresosyegresos/
    │   └── facturacion/              # Rutas de facturación (15 archivos)
    │
    └── services/                     # Servicios auxiliares (si aplica)
```

---

## Modelos de Base de Datos

### Módulo de Autenticación
- **Usuario** (`login.js`) - Usuarios del sistema con roles

### Módulo de Servicios
- **Servicio** (`servicios.js`) - Órdenes de trabajo/servicio

### Módulo de Facturación Electrónica
- **Cliente** - Datos de clientes
- **Emisor** - Datos de la empresa emisora
- **Comprobante** - Boletas, facturas, notas de crédito
- **Detalles** - Líneas de detalle de comprobantes
- **Producto** - Catálogo de productos/servicios
- **Serie** - Series de comprobantes
- **Cuota** - Cuotas de pago diferido
- **GuiaRemision** - Guías de remisión
- **DetalleGuia** - Detalle de guías
- **ComunicacionBaja** - Anulaciones de comprobantes
- **EnvioResumen** - Resúmenes diarios

### Tablas Paramétricas SUNAT
- **Moneda** - Tipos de moneda (PEN, USD)
- **TipoComprobante** - Tipos de comprobante (01: Factura, 03: Boleta, etc.)
- **TipoDocumento** - Tipos de documento identidad (DNI, RUC, etc.)
- **TipoAfectacion** - Tipos de afectación IGV
- **TablaParametrica** - Códigos paramétricos SUNAT
- **Unidad** - Unidades de medida

### Módulo Financiero
- **Ingreso** - Registro de ingresos
- **Egreso** - Registro de egresos

### Otros Módulos
- **Ticket** - Comprobantes tipo ticket
- **Almanaque** - Almanaques personalizados

---

## API Endpoints

### Autenticación y Usuarios

| Método | Ruta | Descripción | Body/Params |
|---|---|---|---|
| GET | `/login` | Listar usuarios | - |
| POST | `/login` | Crear usuario | `{ usuario, password, cargo }` |
| POST | `/login/auth` | Autenticar usuario | `{ usuario, password }` |

### Órdenes de Servicio

| Método | Ruta | Descripción | Body/Params |
|---|---|---|---|
| GET | `/servicios` | Listar todos los trabajos | - |
| GET | `/servicios/:id` | Obtener trabajo por ID | `id` |
| POST | `/servicios` | Crear nuevo trabajo | `{ nombre, cantidad, trabajo, estado, total, acuenta }` |
| PUT | `/servicios/:id` | Actualizar trabajo | `id`, body |
| DELETE | `/servicios/:id` | Eliminar trabajo | `id` |

### Facturación Electrónica

#### Clientes
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/cliente` | Listar clientes |
| POST | `/cliente` | Crear cliente |
| PUT | `/cliente/:id` | Actualizar cliente |
| DELETE | `/cliente/:id` | Eliminar cliente |

#### Comprobantes
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/comprobante` | Listar comprobantes |
| POST | `/comprobante` | Crear comprobante (Boleta/Factura) |
| GET | `/comprobante/:id` | Obtener comprobante por ID |
| PUT | `/comprobante/:id` | Actualizar comprobante |
| DELETE | `/comprobante/:id` | Eliminar comprobante |

#### Productos
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/producto` | Listar productos |
| POST | `/producto` | Crear producto |
| PUT | `/producto/:id` | Actualizar producto |
| DELETE | `/producto/:id` | Eliminar producto |

#### Emisor
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/emisor` | Obtener datos del emisor |
| PUT | `/emisor/:id` | Actualizar datos del emisor |

#### Series
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/serie` | Listar series |
| POST | `/serie` | Crear serie |

#### Tablas Paramétricas
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/moneda` | Listar monedas |
| GET | `/tipo_comprobante` | Listar tipos de comprobante |
| GET | `/tipo_documento` | Listar tipos de documento |
| GET | `/tipo_afectacion` | Listar tipos de afectación IGV |
| GET | `/tabla_parametrica` | Listar códigos paramétricos |
| GET | `/unidad` | Listar unidades de medida |

#### Integración SUNAT
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/sunat/enviar` | Enviar comprobante a SUNAT |
| POST | `/sunat/consultar` | Consultar estado en SUNAT |

### Consulta RENIEC

| Método | Ruta | Descripción | Params |
|---|---|---|---|
| GET | `/api/reniec/:dni` | Consultar datos por DNI | `dni` (8 dígitos) |

### Ingresos y Egresos

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/ingresos` | Listar ingresos |
| POST | `/ingresos` | Registrar ingreso |
| GET | `/egresos` | Listar egresos |
| POST | `/egresos` | Registrar egreso |

### Caja y Punto de Venta (POS)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/caja/apertura` | Abrir un nuevo turno de caja |
| GET | `/caja/actual` | Ver balance actual y ventas del turno |
| PUT | `/caja/:id/cierre` | Cerrar caja y calcular diferencia |
| GET | `/caja/historial` | Historial de cierres |

### Tickets

### Almanaques

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/almanaque` | Listar almanaques |
| POST | `/almanaque` | Crear almanaque |
| GET | `/almanaque/:id` | Obtener almanaque por ID |
| PUT | `/almanaque/:id` | Actualizar almanaque |
| DELETE | `/almanaque/:id` | Eliminar almanaque |

---

## Configuración y Desarrollo

### Requisitos Previos

- **Node.js** >= 18.x
- **PostgreSQL** >= 14.x
- **npm** o **yarn**

### Instalación

1. **Clonar el repositorio** (si aplica):
   ```bash
   cd Backend_servicios_imprenta
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**:
   
   Copiar el archivo `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```

   Editar `.env` con tus credenciales:
   ```env
   # Base de Datos PostgreSQL
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=tu_password
   DB_NAME=servicios

   # Servidor
   PORT=3000

   # Seguridad
   JWT_SECRET=cambia_este_secreto_por_uno_seguro_y_aleatorio

   # CORS - Orígenes permitidos
   ALLOWED_ORIGINS=http://localhost:5173,https://impalexander.store
   ```

4. **Crear la base de datos**:
   ```sql
   CREATE DATABASE servicios;
   ```

5. **Iniciar el servidor**:
   ```bash
   npm start
   ```

   El servidor se iniciará en `http://localhost:3000` y sincronizará automáticamente los modelos con la base de datos.

### Scripts Disponibles

| Comando | Descripción |
|---|---|
| `npm start` | Inicia el servidor con Nodemon (auto-reload) |

---

## Base de Datos

### Configuración PostgreSQL

La conexión a PostgreSQL se configura en `src/database/database.js` usando Sequelize:

```javascript
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false
  }
);
```

### Sincronización de Modelos

Al iniciar el servidor (`index.js`), Sequelize sincroniza automáticamente los modelos con la base de datos:

```javascript
await sequelize.sync({ force: false });
```

> **Nota**: `force: false` preserva los datos existentes. Cambiar a `force: true` **eliminará y recreará todas las tablas** (usar solo en desarrollo).

### Relaciones entre Modelos

Las relaciones entre modelos de facturación están definidas en `src/models/facturacion/asociation.js`:

- **Comprobante** tiene muchos **Detalles** (1:N)
- **Comprobante** pertenece a **Cliente** (N:1)
- **Comprobante** pertenece a **Emisor** (N:1)
- **Comprobante** pertenece a **Serie** (N:1)
- **Detalles** pertenece a **Producto** (N:1)
- Y otras relaciones según la lógica de negocio

---

## Seguridad

### Autenticación

- **Hash de contraseñas**: Las contraseñas se hashean con `bcryptjs` antes de almacenarse
- **JWT**: Se utiliza `jsonwebtoken` para autenticación basada en tokens
- **Middleware de autenticación**: Protege rutas sensibles (si está implementado)

### CORS

El servidor está configurado para aceptar peticiones solo desde orígenes permitidos:

```javascript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:5173"],
  credentials: true,
}));
```

### Variables de Entorno

**NUNCA** commitear el archivo `.env` al repositorio. Usar `.env.example` como plantilla.

---

## Logging

El servidor utiliza **Morgan** en modo `dev` para registrar todas las peticiones HTTP:

```
GET /servicios 200 45.123 ms - 1234
POST /comprobante 201 89.456 ms - 567
```

---

## Manejo de Errores

Middleware global de errores en `src/app.js`:

```javascript
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Error interno del servidor",
  });
});
```

---

## Integración con SUNAT

El sistema incluye integración con los servicios web de SUNAT para facturación electrónica:

- **Firma digital XML** con `xml-crypto`
- **Cliente SOAP** para envío de comprobantes
- **Generación de QR** para comprobantes
- **Generación de PDF** con Puppeteer

---

## Producción

### Dominio de Producción
- **API**: `https://api.impalexander.store/api/`

### Consideraciones
- Usar variables de entorno seguras
- Configurar HTTPS
- Implementar rate limiting
- Configurar logs persistentes
- Backup automático de base de datos
- Monitoreo de servidor

---

## Soporte

Para consultas o problemas, contactar al equipo de desarrollo.
