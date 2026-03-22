# 🚀 Despliegue de Corrección CORS para Producción

## 🎯 Problema Resuelto

**Error Original:**
```
Access to XMLHttpRequest at 'https://api.impalexander.store/auth/login' from origin 'https://impalexander.store'
has been blocked by CORS policy: Response to preflight request doesn't pass access control check:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Causa:** Configuración de CORS incompleta que no manejaba correctamente las solicitudes preflight (OPTIONS).

**Solución:** Configuración completa de CORS con soporte para preflight requests, headers personalizados y cache.

---

## 📋 Cambios Realizados

**Archivo:** `src/infrastructure/web/app.js`

### Antes:
```javascript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:5173"],
  credentials: true,
}));
```

### Después:
```javascript
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map(origin => origin.trim()) || ["http://localhost:5173"];

app.use(cors({
  origin: function (origin, callback) {
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
  maxAge: 86400, // 24 horas
}));

app.options('*', cors());
```

---

## 🚀 Pasos para Desplegar en Producción

### 1. Verificar archivo `.env` en producción

Asegúrate de que tu servidor de producción tenga estos dominios configurados:

```bash
# Conectar al servidor
ssh usuario@servidor-produccion

# Ver el .env
cat /ruta/proyecto/Backend_servicios_imprenta/.env | grep ALLOWED_ORIGINS
```

**Debe contener:**
```env
ALLOWED_ORIGINS=http://localhost:5173,https://api.impalexander.store,https://www.impalexander.store,https://impalexander.store
```

Si falta algún dominio, agregarlo:
```bash
nano /ruta/proyecto/Backend_servicios_imprenta/.env
```

---

### 2. Actualizar el código en producción

```bash
# Opción A: Git pull (si usas repositorio)
cd /ruta/proyecto/Backend_servicios_imprenta
git pull origin main

# Opción B: Copiar archivo manualmente
# Copia el archivo app.js desde tu local al servidor
scp src/infrastructure/web/app.js usuario@servidor:/ruta/proyecto/Backend_servicios_imprenta/src/infrastructure/web/
```

---

### 3. Reiniciar el servidor backend

```bash
# Si usas PM2
pm2 restart backend

# Si usas systemd
sudo systemctl restart backend

# Si usas forever
forever restart backend

# Si usas nodemon (desarrollo)
# Se reiniciará automáticamente

# Verificar que el servidor inició correctamente
pm2 status
# o
pm2 logs backend --lines 50
```

---

### 4. Verificar que CORS funciona

```bash
# Prueba desde tu terminal (reemplaza con tu dominio)
curl -I -X OPTIONS \
  https://api.impalexander.store/auth/login \
  -H "Origin: https://impalexander.store" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
```

**Salida esperada:**
```
HTTP/2 204
access-control-allow-origin: https://impalexander.store
access-control-allow-credentials: true
access-control-allow-methods: GET,POST,PUT,DELETE,PATCH,OPTIONS
access-control-allow-headers: Content-Type,Authorization,X-Requested-With,Accept
access-control-max-age: 86400
```

---

### 5. Probar desde el navegador

1. Abre tu aplicación en producción: `https://impalexander.store`
2. Abre DevTools (F12) → Pestaña "Network"
3. Intenta hacer login
4. Verifica que:
   - ✅ La solicitud OPTIONS (preflight) retorna `204 No Content`
   - ✅ Los headers `Access-Control-Allow-Origin` están presentes
   - ✅ La solicitud POST al login funciona correctamente
   - ✅ No hay errores de CORS en la consola

---

## 🔍 Verificación de Logs

### Ver logs del servidor para detectar orígenes bloqueados:

```bash
# PM2
pm2 logs backend --lines 100 | grep "CORS bloqueado"

# Systemd
journalctl -u backend -n 100 | grep "CORS bloqueado"
```

Si ves mensajes como:
```
⚠️  CORS bloqueado para origen: https://otro-dominio.com
```

Significa que ese dominio **NO** está en `ALLOWED_ORIGINS` y está siendo rechazado correctamente.

---

## ⚙️ Configuración de Nginx/Apache (si aplica)

Si usas Nginx o Apache como reverse proxy, asegúrate de que **NO** estén agregando sus propios headers CORS, ya que podría causar conflictos.

### Nginx - Configuración correcta:

```nginx
server {
    listen 443 ssl;
    server_name api.impalexander.store;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # NO agregar headers CORS aquí, Node.js los maneja
    }
}
```

---

## 🧪 Tests Adicionales

### Test desde diferentes orígenes:

```bash
# Test desde impalexander.store
curl -I -X OPTIONS https://api.impalexander.store/auth/login \
  -H "Origin: https://impalexander.store"

# Test desde www.impalexander.store
curl -I -X OPTIONS https://api.impalexander.store/auth/login \
  -H "Origin: https://www.impalexander.store"

# Test desde origen NO permitido (debe fallar)
curl -I -X OPTIONS https://api.impalexander.store/auth/login \
  -H "Origin: https://malicioso.com"
```

---

## 📊 Monitoreo Post-Despliegue

Después de desplegar, monitorea por 15-30 minutos:

```bash
# Ver logs en tiempo real
pm2 logs backend

# Ver uso de memoria/CPU
pm2 monit

# Ver requests HTTP
tail -f /var/log/nginx/access.log
```

---

## 🆘 Troubleshooting

### Problema: Sigue apareciendo error CORS

**Solución 1:** Limpiar cache del navegador
```
Chrome: Ctrl+Shift+Del → Borrar caché e imágenes
Firefox: Ctrl+Shift+Del → Caché
```

**Solución 2:** Verificar que el servidor realmente se reinició
```bash
pm2 restart backend --update-env
```

**Solución 3:** Verificar que no haya múltiples instancias corriendo
```bash
pm2 delete all
pm2 start ecosystem.config.js
```

### Problema: Header duplicado

**Causa:** Nginx/Apache también agrega headers CORS

**Solución:** Quitar los headers CORS de Nginx/Apache y dejar que Node.js los maneje

---

## ✅ Checklist de Despliegue

- [ ] Archivo `app.js` actualizado en servidor
- [ ] Variable `ALLOWED_ORIGINS` correcta en `.env`
- [ ] Servidor backend reiniciado
- [ ] Test de preflight OPTIONS exitoso
- [ ] Login funciona desde producción
- [ ] No hay errores CORS en consola
- [ ] Logs no muestran orígenes bloqueados inesperados
- [ ] Cache del navegador limpiado
- [ ] Nginx/Apache no agrega headers CORS duplicados

---

## 📞 Soporte

Si el problema persiste:
1. Revisa los logs del servidor: `pm2 logs backend`
2. Verifica la respuesta OPTIONS con curl
3. Comprueba que el dominio esté en `ALLOWED_ORIGINS`
4. Asegúrate de que no haya proxies intermedios agregando headers

---

**Fecha:** 2026-03-22
**Versión:** 1.0
**Autor:** Claude Code
