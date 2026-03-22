# 🚨 Solución Rápida de CORS en Producción

## ⚡ Comando Rápido (Servidor con SSH)

```bash
# 1. Conectar al servidor
ssh usuario@tu-servidor

# 2. Ir al directorio del proyecto
cd /ruta/Backend_servicios_imprenta

# 3. Actualizar código
git pull origin main

# 4. Reiniciar servidor
pm2 restart backend --update-env

# 5. Verificar que funcionó
curl -I -X OPTIONS https://api.impalexander.store/auth/login \
  -H "Origin: https://impalexander.store" \
  -H "Access-Control-Request-Method: POST"

# Debe mostrar:
# access-control-allow-origin: https://impalexander.store
```

---

## 🔍 Diagnóstico

### 1. Verificar configuración CORS actual

```bash
# Desde tu navegador, abre:
https://api.impalexander.store/health/cors

# Debe mostrar algo como:
{
  "status": "ok",
  "cors": {
    "allowedOrigins": [
      "http://localhost:5173",
      "https://api.impalexander.store",
      "https://www.impalexander.store",
      "https://impalexander.store"
    ],
    "requestOrigin": "https://impalexander.store",
    "originAllowed": true
  }
}
```

---

## 🛠️ Si No Tienes Git en Servidor

### Subir archivos manualmente:

```bash
# Desde tu local
cd /Volumes/Almacenamiento/imprenta/Desarrollo/Backend_servicios_imprenta

# Subir app.js
scp src/infrastructure/web/app.js \
  usuario@servidor:/ruta/Backend_servicios_imprenta/src/infrastructure/web/

# Subir health.routes.js
scp src/infrastructure/web/routes/health.routes.js \
  usuario@servidor:/ruta/Backend_servicios_imprenta/src/infrastructure/web/routes/

# Conectar y reiniciar
ssh usuario@servidor
cd /ruta/Backend_servicios_imprenta
pm2 restart backend
```

---

## 🚀 Script Automático

Si tienes acceso SSH al servidor:

```bash
# Ejecutar script de corrección
./fix_cors_production.sh
```

Este script:
- ✅ Verifica archivos
- ✅ Valida .env
- ✅ Reinicia servidor
- ✅ Prueba CORS
- ✅ Muestra diagnóstico

---

## ⚙️ Verificar Nginx/Apache

Si usas Nginx como proxy, verifica que NO tenga headers CORS duplicados:

```nginx
# /etc/nginx/sites-available/api.impalexander.store

server {
    listen 443 ssl;
    server_name api.impalexander.store;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # ⚠️ NO agregar headers CORS aquí
        # Node.js los maneja
    }

    # SSL configuración
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
}
```

Si encuentras líneas como estas, **ELIMÍNALAS**:
```nginx
# ❌ ELIMINAR ESTAS LÍNEAS
add_header 'Access-Control-Allow-Origin' '*';
add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
add_header 'Access-Control-Allow-Headers' 'Content-Type';
```

Luego reinicia Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🧪 Probar desde Navegador

1. Abre DevTools (F12)
2. Ve a la pestaña **Network**
3. Marca **Preserve log**
4. Intenta hacer login en `https://impalexander.store`
5. Busca la request `OPTIONS /auth/login`
6. Verifica que los headers de respuesta incluyan:
   ```
   access-control-allow-origin: https://impalexander.store
   access-control-allow-credentials: true
   access-control-allow-methods: GET,POST,PUT,DELETE,PATCH,OPTIONS
   ```

---

## 🔴 Checklist de Problemas Comunes

- [ ] **Servidor NO reiniciado**: `pm2 restart backend --update-env`
- [ ] **Caché del navegador**: Ctrl+Shift+Del → Borrar caché
- [ ] **Nginx agrega headers CORS**: Eliminar headers CORS de Nginx
- [ ] **Puerto incorrecto**: Verificar que el servidor corra en puerto 3000
- [ ] **Firewall bloqueando**: Verificar puertos abiertos
- [ ] **SSL/HTTPS**: Verificar certificados SSL válidos
- [ ] **.env no actualizado**: Verificar `ALLOWED_ORIGINS` tiene todos los dominios

---

## 📞 Test Rápido

```bash
# Test 1: Servidor responde
curl https://api.impalexander.store/health

# Test 2: CORS permite origen
curl -I -X OPTIONS https://api.impalexander.store/auth/login \
  -H "Origin: https://impalexander.store" \
  -H "Access-Control-Request-Method: POST"

# Test 3: Login funciona
curl -X POST https://api.impalexander.store/auth/login \
  -H "Origin: https://impalexander.store" \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

---

## ✅ Señales de que CORS está Funcionando

1. ✅ `OPTIONS /auth/login` retorna `204 No Content`
2. ✅ Header `access-control-allow-origin` presente
3. ✅ Header `access-control-allow-credentials: true` presente
4. ✅ POST a `/auth/login` funciona desde el navegador
5. ✅ NO hay errores CORS en la consola del navegador

---

**Última actualización:** 2026-03-22
