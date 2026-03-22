# 🚨 Solución Error ENUM en Producción

## ❌ Error:
```
cannot cast type tipo_almanaque to enum_almanaques_tipo
```

## 🔍 Causa:
Conflicto entre dos tipos ENUM:
- `tipo_almanaque` (creado por nuestra migración) ✅
- `enum_almanaques_tipo` (que Sequelize intenta crear) ❌

---

## ⚡ Solución Rápida (3 pasos)

### **Paso 1: Conectar al servidor**
```bash
ssh usuario@tu-servidor
cd /home/appimprenta/Backend/Backend_servicios_imprenta
```

### **Paso 2: Ejecutar script de corrección**
```bash
# Subir archivos actualizados desde local
# (ejecuta esto en tu máquina local primero)
scp fix_enum_conflict.js usuario@servidor:/home/appimprenta/Backend/Backend_servicios_imprenta/
scp src/infrastructure/database/models/almanaque/almanaque.js usuario@servidor:/home/appimprenta/Backend/Backend_servicios_imprenta/src/infrastructure/database/models/almanaque/

# Luego en el servidor, ejecutar:
node fix_enum_conflict.js
```

### **Paso 3: Reiniciar servidor**
```bash
pm2 restart Imprenta
pm2 logs Imprenta
```

---

## 🛠️ Solución Manual (si el script falla)

### Conectar a PostgreSQL:
```bash
psql -U admin2025 -d servicios
```

### Ejecutar estos comandos SQL:
```sql
-- 1. Eliminar tipo ENUM creado por Sequelize
DROP TYPE IF EXISTS "public"."enum_almanaques_tipo" CASCADE;

-- 2. Verificar que tipo_almanaque existe
SELECT typname, enumlabel
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname = 'tipo_almanaque';

-- 3. Verificar columna tipo en almanaques
\d almanaques

-- 4. Si la columna tipo no usa tipo_almanaque, corregir:
ALTER TABLE almanaques
ALTER COLUMN tipo TYPE tipo_almanaque
USING tipo::text::tipo_almanaque;

-- 5. Salir
\q
```

### Reiniciar servidor:
```bash
pm2 restart Imprenta
```

---

## ✅ Verificación

Después de reiniciar, verifica que el servidor inicie sin errores:

```bash
pm2 logs Imprenta --lines 50
```

**Debe mostrar:**
```
✅ Base de datos sincronizada
Servidor corriendo en puerto 3000
```

**NO debe mostrar:**
```
❌ cannot cast type tipo_almanaque to enum_almanaques_tipo
```

---

## 📊 Verificar datos

```bash
psql -U admin2025 -d servicios -c "SELECT tipo, COUNT(*) FROM almanaques GROUP BY tipo;"
```

**Resultado esperado:**
```
     tipo     | count
--------------+-------
 cotizacion   |     1
(1 row)
```

---

## 🔄 Si el problema persiste

### Opción A: Recrear el tipo ENUM desde cero

```sql
-- ADVERTENCIA: Esto eliminará la columna tipo temporalmente
BEGIN;

-- 1. Eliminar columna tipo
ALTER TABLE almanaques DROP COLUMN IF EXISTS tipo;

-- 2. Eliminar todos los tipos ENUM relacionados
DROP TYPE IF EXISTS tipo_almanaque CASCADE;
DROP TYPE IF EXISTS enum_almanaques_tipo CASCADE;

-- 3. Crear tipo ENUM limpio
CREATE TYPE tipo_almanaque AS ENUM ('cotizacion', 'venta');

-- 4. Agregar columna tipo con el tipo correcto
ALTER TABLE almanaques
ADD COLUMN tipo tipo_almanaque NOT NULL DEFAULT 'cotizacion';

-- 5. Si todo está bien, confirmar:
COMMIT;

-- Si algo sale mal, revertir:
-- ROLLBACK;
```

### Opción B: Desactivar sincronización de Sequelize

Editar `main.js`:

```javascript
// ANTES:
await sequelize.sync({ alter: true });

// DESPUÉS:
// await sequelize.sync({ alter: true }); // Desactivado para evitar conflictos ENUM
await sequelize.authenticate();
console.log('✅ Base de datos conectada (sin sincronización automática)');
```

---

## 📝 Cambios Realizados en el Código

**Archivo:** `src/infrastructure/database/models/almanaque/almanaque.js`

**ANTES:**
```javascript
tipo: {
  type: DataTypes.ENUM('cotizacion', 'venta'),
  allowNull: false,
  defaultValue: 'cotizacion',
},
```

**DESPUÉS:**
```javascript
tipo: {
  // Usar STRING para evitar que Sequelize cree su propio ENUM
  type: DataTypes.STRING,
  allowNull: false,
  defaultValue: 'cotizacion',
  validate: {
    isIn: [['cotizacion', 'venta']]
  }
},
```

**¿Por qué?**
- Evita que Sequelize cree `enum_almanaques_tipo`
- La validación en la BD ya existe con `tipo_almanaque`
- La validación de Sequelize asegura valores correctos

---

## 🎯 Resumen

1. ✅ **Script de corrección:** `fix_enum_conflict.js`
2. ✅ **Modelo actualizado:** `almanaque.js`
3. ✅ **Reiniciar servidor:** `pm2 restart Imprenta`
4. ✅ **Verificar logs:** `pm2 logs Imprenta`

---

**Fecha:** 2026-03-22
**Versión:** 1.0
