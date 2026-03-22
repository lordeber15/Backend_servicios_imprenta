# 📋 Guía de Migraciones - Sistema Imprenta

Este documento describe todas las migraciones disponibles y cómo ejecutarlas.

---

## 🚀 Comando Rápido (Recomendado)

Para verificar y aplicar todas las migraciones automáticamente:

```bash
node check_and_migrate.js
```

Este script:
- ✅ Verifica si cada migración ya está aplicada
- ✅ Solo ejecuta las migraciones que faltan
- ✅ Es seguro ejecutarlo múltiples veces
- ✅ Muestra un resumen completo al finalizar

---

## 📦 Migraciones Disponibles

### 1. **metodo_pago en Tickets y Comprobante**
**Archivo:** `migrate_payment.js`

Agrega la columna `metodo_pago` a las tablas Tickets y Comprobante para registrar el método de pago utilizado (Efectivo, Yape, etc.)

```bash
node migrate_payment.js
```

**Cambios:**
- `Tickets.metodo_pago` VARCHAR(50) DEFAULT 'Efectivo'
- `Comprobante.metodo_pago` VARCHAR(50) DEFAULT 'Efectivo'

---

### 2. **Campo tipo en almanaques**
**Archivo:** `migrate_almanaques.js`

Agrega el campo `tipo` a la tabla almanaques para diferenciar entre cotizaciones y ventas confirmadas.

```bash
node migrate_almanaques.js
```

**Cambios:**
- Crea tipo ENUM `tipo_almanaque ('cotizacion', 'venta')`
- `almanaques.tipo` tipo_almanaque DEFAULT 'cotizacion'
- Marca registros existentes como 'cotizacion'

**Impacto:**
- Las cotizaciones (tipo='cotizacion') NO se suman a los ingresos diarios
- Las ventas (tipo='venta') SÍ se suman a los ingresos diarios

---

## 🔄 Flujo Recomendado

### Desarrollo Local
```bash
# 1. Verificar y aplicar migraciones
node check_and_migrate.js

# 2. Reiniciar servidor
npm run dev
```

### Producción
```bash
# 1. Conectar al servidor
ssh usuario@servidor

# 2. Ir al directorio del proyecto
cd /ruta/proyecto/Backend_servicios_imprenta

# 3. Hacer backup de la base de datos (IMPORTANTE)
pg_dump -U servicios -d servicios > backup_$(date +%Y%m%d_%H%M%S).sql

# 4. Verificar y aplicar migraciones
node check_and_migrate.js

# 5. Reiniciar servidor
pm2 restart backend
# o
systemctl restart backend
```

---

## 🔍 Verificación Manual

### Verificar si las migraciones están aplicadas:

```sql
-- Verificar columna metodo_pago en Tickets
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'Tickets' AND column_name = 'metodo_pago';

-- Verificar columna metodo_pago en Comprobante
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'Comprobante' AND column_name = 'metodo_pago';

-- Verificar tipo ENUM
SELECT typname FROM pg_type WHERE typname = 'tipo_almanaque';

-- Verificar columna tipo en almanaques
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'almanaques' AND column_name = 'tipo';

-- Ver estado de almanaques
SELECT tipo, COUNT(*) as total FROM almanaques GROUP BY tipo;
```

---

## ⚠️ Rollback (Revertir Migraciones)

### Revertir metodo_pago:
```sql
ALTER TABLE "Tickets" DROP COLUMN metodo_pago;
ALTER TABLE "Comprobante" DROP COLUMN metodo_pago;
```

### Revertir tipo en almanaques:
```sql
ALTER TABLE almanaques DROP COLUMN tipo;
DROP TYPE tipo_almanaque;
```

---

## 📊 Salida Esperada

Al ejecutar `check_and_migrate.js`:

```
✅ Conectado a la base de datos

📋 1. Verificando columna metodo_pago en Tickets...
✓  Ya existe. Omitiendo...
📋 2. Verificando columna metodo_pago en Comprobante...
✓  Ya existe. Omitiendo...
📋 3. Verificando tipo ENUM tipo_almanaque...
✓  Ya existe. Omitiendo...
📋 4. Verificando columna tipo en almanaques...
✓  Ya existe. Omitiendo...

============================================================
📊 RESUMEN DE MIGRACIONES
============================================================
✅ Migraciones aplicadas: 0
⏭️  Migraciones omitidas: 4

============================================================
🔍 VERIFICACIÓN FINAL
============================================================

📊 Estado de almanaques:
┌─────────┬──────────────┬───────┐
│ (index) │ tipo         │ total │
├─────────┼──────────────┼───────┤
│ 0       │ 'cotizacion' │ '1'   │
└─────────┴──────────────┴───────┘

✅ Tickets.metodo_pago: OK
✅ Comprobante.metodo_pago: OK
✅ almanaques.tipo: OK

============================================================
🎉 TODAS LAS MIGRACIONES ESTÁN APLICADAS
============================================================
```

---

## 🆘 Solución de Problemas

### Error: "relation does not exist"
**Causa:** La tabla no existe en la base de datos
**Solución:** Verificar que estás conectado a la base de datos correcta

### Error: "duplicate column name"
**Causa:** La migración ya fue aplicada
**Solución:** Normal, el script omitirá esta migración automáticamente

### Error: "permission denied"
**Causa:** El usuario de PostgreSQL no tiene permisos
**Solución:** Ejecutar con un usuario que tenga permisos de ALTER TABLE

---

## 📝 Notas

- ✅ Todas las migraciones son **idempotentes** (se pueden ejecutar múltiples veces sin causar errores)
- ✅ El script `check_and_migrate.js` es **seguro para producción**
- ✅ Siempre hace **backup antes de ejecutar migraciones en producción**
- ✅ Las migraciones son **compatibles con PostgreSQL 12+**

---

## 📞 Soporte

Si encuentras algún problema con las migraciones, revisa:
1. Los logs del servidor (`pm2 logs backend`)
2. Los logs de PostgreSQL
3. El archivo `.env` para verificar las credenciales de BD

---

**Última actualización:** 2026-03-22
