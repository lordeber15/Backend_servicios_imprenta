# 📊 Migración: Ventas para Suma en Caja

## 🎯 Objetivo

Asegurar que **todos los comprobantes importados desde XML se sumen correctamente** en el cálculo de ingresos/ventas de caja.

---

## ❓ ¿Por qué es necesario?

El sistema de caja calcula los ingresos diarios sumando:

1. **Tickets** (con `metodo_pago`)
2. **Comprobantes** (facturas/boletas con `metodo_pago`)
3. **Almanaques** (solo tipo `'venta'`)

Los comprobantes importados desde XML **NO tenían asignado** el campo `metodo_pago`, por lo que **NO se sumaban** en el cálculo de caja.

---

## ✅ Solución

### 1. Actualizar Importador (Ya hecho)

El script `import_xml_to_db.js` ahora asigna automáticamente:

```javascript
metodo_pago: 'Efectivo'  // Por defecto para todos los comprobantes importados
```

### 2. Migrar Comprobantes Existentes

Ejecuta el script de migración para actualizar comprobantes ya importados:

```bash
node migrate_metodo_pago_comprobantes.js
```

---

## 🚀 Paso a Paso: Migración Completa

### **Paso 1: Verificar estado actual**

```bash
node verify_imported_data.js
```

Busca esta sección:
```
🔍 VERIFICACIÓN DE INTEGRIDAD
────────────────────────────────────────────────────────────
Comprobantes sin metodo_pago:  ⚠️  12
```

Si ves comprobantes sin `metodo_pago`, necesitas ejecutar la migración.

---

### **Paso 2: Ejecutar migración**

```bash
node migrate_metodo_pago_comprobantes.js
```

**Salida esperada:**

```
╔═══════════════════════════════════════════════════════════╗
║    MIGRACIÓN: Asignar metodo_pago a Comprobantes         ║
╚═══════════════════════════════════════════════════════════╝

✅ Conectado a la base de datos

📊 Analizando comprobantes...

Comprobantes SIN metodo_pago:  12
Comprobantes CON metodo_pago:  0
Total comprobantes:             12

📋 Vista previa de cambios:

────────────────────────────────────────────────────────────
F001-00000006 | forma_pago: Contado    → metodo_pago: Efectivo    | S/ 30.00
F001-00000001 | forma_pago: Contado    → metodo_pago: Efectivo    | S/ 130.00
F001-00000007 | forma_pago: Contado    → metodo_pago: Efectivo    | S/ 160.00
...
────────────────────────────────────────────────────────────

⚠️  Esta migración actualizará los comprobantes mostrados.
⚠️  Los comprobantes podrán sumarse en el cálculo de caja.

¿Continuar con la migración? (si/no): si

🔄 Ejecutando migración...

   Procesados: 12/12

╔═══════════════════════════════════════════════════════════╗
║                      RESUMEN                              ║
╚═══════════════════════════════════════════════════════════╝
✅ Comprobantes actualizados:  12
❌ Errores:                    0
📊 Total procesados:           12

🔍 Verificando actualización...

Comprobantes SIN metodo_pago:  0
Comprobantes CON metodo_pago:  12

✅ ¡Migración completada exitosamente!
✅ Todos los comprobantes ahora tienen metodo_pago asignado.
✅ Los comprobantes se sumarán correctamente en la caja.

💰 RESUMEN DE VENTAS POR MÉTODO DE PAGO

────────────────────────────────────────────────────────────
Efectivo     | Cantidad:  10 | Total:    S/ 736.00
```

---

### **Paso 3: Verificar que funciona**

```bash
node verify_imported_data.js
```

Ahora debería mostrar:
```
Comprobantes sin metodo_pago:  ✅ 0
```

---

## 📊 Cómo Funciona el Cálculo de Caja

El controlador de caja (`caja.controller.js`) suma automáticamente:

```javascript
// Comprobantes en Efectivo
Comprobante.sum("total", {
  where: {
    fecha_emision: { [Op.gte]: fechaDesde },
    tipo_comprobante_id: { [Op.in]: ["01", "03"] }, // Solo facturas y boletas
    estado_sunat: { [Op.ne]: "AN" },                 // No anulados
    metodo_pago: 'Efectivo',                          // ← CRÍTICO
  },
})

// Comprobantes con Yape
Comprobante.sum("total", {
  where: {
    ...
    metodo_pago: 'Yape',  // ← CRÍTICO
  },
})
```

**Sin `metodo_pago` → NO se suman en la caja**

---

## 🔄 Flujo Completo: Importación + Migración

### Para nuevos XML:

```bash
# 1. Importar comprobantes desde XML
node import_xml_to_db.js

# 2. Verificar importación
node verify_imported_data.js

# ✅ Los nuevos comprobantes YA tienen metodo_pago asignado
#    (gracias a la actualización del importador)
```

### Para XML ya importados anteriormente:

```bash
# 1. Ejecutar migración
node migrate_metodo_pago_comprobantes.js

# 2. Confirmar con: si

# 3. Verificar
node verify_imported_data.js
```

---

## 🧪 Prueba de Suma en Caja

Después de la migración, prueba el cálculo de caja:

```bash
# Abrir caja
curl -X POST http://localhost:3000/caja/abrir \
  -H "Content-Type: application/json" \
  -d '{"monto_apertura": 100, "observacion": "Prueba"}'

# Ver caja actual
curl http://localhost:3000/caja/actual
```

**Resultado esperado:**

```json
{
  "caja": {
    "id": 1,
    "monto_apertura": 100,
    "estado": "abierta"
  },
  "ventas": {
    "ventas_tickets": 0,
    "ventas_comprobantes": 736.00,  // ← Ahora suma los comprobantes
    "total_efectivo": 736.00,
    "total_yape": 0,
    "total": 736.00
  }
}
```

---

## 📝 Reglas de Asignación

El script asigna `metodo_pago` basándose en `forma_pago`:

| forma_pago | → | metodo_pago |
|------------|---|-------------|
| Contado    | → | Efectivo    |
| Crédito    | → | Efectivo    |
| NULL       | → | Efectivo    |

**¿Por qué todo se asigna como "Efectivo"?**

- Los XML de SUNAT solo indican "Contado" o "Crédito" (forma de pago)
- NO especifican si fue efectivo, tarjeta, Yape, etc. (método de pago)
- Se asume "Efectivo" por defecto para que se sumen en la caja
- **Si necesitas diferenciar**, puedes editar manualmente los comprobantes después

---

## 🔧 Personalizar Método de Pago

Si quieres asignar un método diferente por defecto, edita:

**En `import_xml_to_db.js`:**

```javascript
// Línea ~225
const metodoPago = formaPago === 'Contado' ? 'Efectivo' : 'Efectivo';

// Cambiar a:
const metodoPago = formaPago === 'Contado' ? 'Yape' : 'Efectivo';
```

**En `migrate_metodo_pago_comprobantes.js`:**

```javascript
// Línea ~200
function determinarMetodoPago(formaPago) {
  if (forma === 'contado') return 'Efectivo';  // ← Cambiar aquí
  return 'Efectivo';
}
```

---

## 🚨 Troubleshooting

### Error: "Comprobantes sin metodo_pago: ⚠️ 12"

**Causa:** Los comprobantes fueron importados antes de actualizar el script.

**Solución:**
```bash
node migrate_metodo_pago_comprobantes.js
```

### Error: "Los comprobantes no se suman en la caja"

**Verificar:**

1. Que los comprobantes tengan `metodo_pago`:
   ```bash
   node verify_imported_data.js
   ```

2. Que el `tipo_comprobante_id` sea `'01'` (Factura) o `'03'` (Boleta):
   - Las Guías (09, 31) NO se suman en la caja

3. Que el `estado_sunat` NO sea `'AN'` (Anulado)

### Error: "Cannot find module 'readline'"

No es necesario instalar nada, `readline` viene con Node.js.

---

## 📊 Consultas SQL Útiles

### Ver comprobantes sin metodo_pago:

```sql
SELECT serie, correlativo, forma_pago, metodo_pago, total
FROM "Comprobante"
WHERE metodo_pago IS NULL;
```

### Actualizar manualmente un comprobante:

```sql
UPDATE "Comprobante"
SET metodo_pago = 'Yape'
WHERE serie = 'F001' AND correlativo = 11;
```

### Ver suma de ventas por método:

```sql
SELECT
  metodo_pago,
  COUNT(*) as cantidad,
  SUM(total) as total
FROM "Comprobante"
WHERE tipo_comprobante_id IN ('01', '03')
  AND estado_sunat != 'AN'
  AND metodo_pago IS NOT NULL
GROUP BY metodo_pago;
```

---

## ✅ Checklist de Migración

- [ ] Ejecutar `node verify_imported_data.js` (verificar estado inicial)
- [ ] Ejecutar `node migrate_metodo_pago_comprobantes.js`
- [ ] Confirmar con "si"
- [ ] Verificar que todos los comprobantes tienen `metodo_pago`
- [ ] Probar cálculo de caja con `curl` o desde el frontend
- [ ] Verificar que las ventas se suman correctamente

---

## 📞 Comandos Rápidos

```bash
# Importar XML
node import_xml_to_db.js

# Migrar metodo_pago
node migrate_metodo_pago_comprobantes.js

# Verificar datos
node verify_imported_data.js

# Ver comprobantes sin metodo_pago (SQL)
psql -U admin2025 -d servicios -c "SELECT COUNT(*) FROM \"Comprobante\" WHERE metodo_pago IS NULL;"
```

---

**Última actualización:** 2026-03-22
