# 📥 Importador de Comprobantes desde XML

Script para importar comprobantes electrónicos (Facturas, Boletas, Notas) desde archivos XML formato UBL 2.1 de SUNAT.

---

## 🚀 Uso Rápido

```bash
# Ejecutar importación
node import_xml_to_db.js

# O usando npm
npm run import:xml
```

---

## 📋 ¿Qué hace el script?

1. **Escanea** todos los archivos XML en `storage/xml/`
2. **Parsea** cada XML (formato UBL 2.1 de SUNAT)
3. **Extrae** automáticamente:
   - Tipo de comprobante (01=Factura, 03=Boleta, etc.)
   - Serie y correlativo
   - Fecha de emisión
   - Cliente (RUC/DNI, razón social)
   - Totales (base imponible, IGV, total)
   - Detalles/items del comprobante
4. **Crea** automáticamente:
   - Cliente (si no existe)
   - Serie (si no existe)
   - Comprobante (cabecera)
   - Detalles (items)
5. **Omite** comprobantes duplicados (ya existentes)

---

## 📁 Estructura de Archivos XML

Los archivos XML deben seguir el formato estándar de SUNAT:

```
{RUC}-{TIPO}-{SERIE}-{CORRELATIVO}.xml
```

**Ejemplos:**
```
20608582011-01-F001-00000011.xml  → Factura F001-00000011
20608582011-03-B001-00000001.xml  → Boleta B001-00000001
20608582011-07-FC01-00000001.xml  → Nota de Crédito FC01-00000001
```

### Tipos de Comprobante Soportados:

| Código | Tipo                        |
|--------|-----------------------------|
| 01     | Factura                     |
| 03     | Boleta de Venta             |
| 07     | Nota de Crédito             |
| 08     | Nota de Débito              |
| 09     | Guía de Remisión            |
| 31     | Guía de Remisión - Transp.  |

---

## 📊 Salida del Script

```
╔═══════════════════════════════════════════════════════════╗
║     IMPORTADOR DE COMPROBANTES DESDE XML (UBL 2.1)       ║
╚═══════════════════════════════════════════════════════════╝

🔌 Conectando a la base de datos...
✅ Conexión establecida

📋 Archivos encontrados: 12

📄 Procesando: 20608582011-01-F001-00000011.xml
   ✅ Cliente creado: 20608582011 - Imprenta alexander
   ✅ Serie creada: 01-F001 (correlativo: 11)
   ✅ Comprobante creado: F001-00000011 | Total: S/ 100
   ✅ 1 detalle(s) insertado(s)

📄 Procesando: 20608582011-03-B001-00000001.xml
   ⏭️  Ya existe: B001-00000001

╔═══════════════════════════════════════════════════════════╗
║                       RESUMEN                             ║
╚═══════════════════════════════════════════════════════════╝
✅ Comprobantes creados:  10
⏭️  Comprobantes omitidos: 2 (ya existían)
❌ Errores:               0
📊 Total procesados:      12

🔌 Conexión cerrada
```

---

## 🔧 Instalación de Dependencias

Si el script falla por falta de dependencias:

```bash
npm install xml2js
```

---

## ⚙️ Configuración

El script usa las variables de entorno en `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=admin2025
DB_PASSWORD=tu_password
DB_NAME=servicios
```

---

## 📌 Notas Importantes

### 1. Emisor Predeterminado

El script asume que existe un emisor con `ID = 1` en la base de datos. Si no existe:

```sql
-- Verificar emisores
SELECT * FROM "Emisor";

-- Si no existe, crear uno
INSERT INTO "Emisor" (id, ruc, razon_social, nombre_comercial)
VALUES (1, '20608582011', 'DISTRIBUIDORA IMPRENTA ALEXANDER', 'IMPRENTA ALEXANDER');
```

### 2. Clientes Automáticos

El script crea automáticamente clientes que no existen en la BD con la información extraída del XML.

### 3. Series Automáticas

Si una serie no existe, se crea automáticamente y se asigna el correlativo del comprobante actual.

### 4. Estado SUNAT

Los comprobantes importados se marcan como `estado_sunat = 'AC'` (Aceptado) porque se asume que si el XML existe, ya fue procesado exitosamente por SUNAT.

### 5. Duplicados

El script NO sobrescribe comprobantes existentes. Si encuentra uno con la misma serie y correlativo, lo omite.

---

## 🔍 Verificación de Datos Importados

```sql
-- Ver comprobantes importados hoy
SELECT
  serie,
  correlativo,
  fecha_emision,
  total,
  estado_sunat
FROM "Comprobante"
WHERE fecha_emision >= CURRENT_DATE
ORDER BY fecha_emision DESC;

-- Ver con cliente
SELECT
  c.serie,
  c.correlativo,
  cl.razon_social,
  c.total,
  c.fecha_emision
FROM "Comprobante" c
JOIN "Cliente" cl ON c.cliente_id = cl.id
ORDER BY c.fecha_emision DESC
LIMIT 10;

-- Ver detalles de un comprobante
SELECT
  d.item,
  d.descripcion,
  d.cantidad,
  d.precio_unitario,
  d.importe_total
FROM "Detalle" d
WHERE d.comprobante_id = 1; -- ID del comprobante
```

---

## 🐛 Troubleshooting

### Error: "xml2js not found"

```bash
npm install xml2js
```

### Error: "Cannot connect to database"

Verifica tu archivo `.env`:
```bash
cat .env | grep DB_
```

### Error: "Formato de archivo inválido"

Los archivos XML deben seguir el formato:
```
{RUC}-{TIPO}-{SERIE}-{CORRELATIVO}.xml
```

Ejemplo correcto: `20608582011-01-F001-00000011.xml`

### Error: "Foreign key constraint fails"

Verifica que exista:
1. Un emisor con ID 1
2. Los tipos de comprobante en tabla `TipoComprobante` (01, 03, 07, 08, etc.)
3. Los tipos de documento en tabla `TipoDocumento` (1=DNI, 6=RUC, etc.)

---

## 🔄 Actualizar Correlativos

Si necesitas actualizar los correlativos de las series después de importar:

```sql
-- Ver correlativos actuales
SELECT
  tipo_comprobante_id,
  serie,
  correlativo
FROM "Serie"
ORDER BY tipo_comprobante_id, serie;

-- Actualizar correlativo manualmente (si es necesario)
UPDATE "Serie"
SET correlativo = 15
WHERE tipo_comprobante_id = '01' AND serie = 'F001';
```

---

## 📞 Comandos Útiles

```bash
# Listar archivos XML
ls -lh storage/xml/

# Contar archivos XML
ls storage/xml/*.xml | wc -l

# Ver contenido de un XML específico
cat storage/xml/20608582011-01-F001-00000011.xml | head -50

# Ejecutar importación en modo verbose (con más logs)
node import_xml_to_db.js 2>&1 | tee import.log
```

---

## 🎯 Casos de Uso

### 1. Migración Inicial

Importa todos los comprobantes históricos de un periodo:

```bash
# 1. Asegúrate que todos los XML estén en storage/xml/
ls storage/xml/*.xml

# 2. Ejecuta la importación
node import_xml_to_db.js

# 3. Verifica los datos importados
psql -U admin2025 -d servicios -c "SELECT COUNT(*) FROM \"Comprobante\";"
```

### 2. Importación Incremental

Agrega nuevos comprobantes sin duplicar:

```bash
# 1. Copia nuevos XML a storage/xml/
cp ~/descargas/*.xml storage/xml/

# 2. Ejecuta importación (omitirá existentes)
node import_xml_to_db.js
```

### 3. Re-importación con Limpieza

Si necesitas re-importar desde cero:

```sql
-- ⚠️ CUIDADO: Esto borra todos los comprobantes
TRUNCATE "Detalle" CASCADE;
TRUNCATE "Comprobante" CASCADE;
TRUNCATE "Serie" RESTART IDENTITY CASCADE;
```

Luego ejecuta:
```bash
node import_xml_to_db.js
```

---

## ✅ Checklist Post-Importación

- [ ] Verificar cantidad de comprobantes importados
- [ ] Verificar que los totales coinciden con los XML originales
- [ ] Verificar que las series tienen correlativos correctos
- [ ] Verificar que los clientes se crearon correctamente
- [ ] Probar generar un reporte de ventas
- [ ] Verificar que no hay comprobantes duplicados

```sql
-- Buscar duplicados
SELECT serie, correlativo, COUNT(*)
FROM "Comprobante"
GROUP BY serie, correlativo
HAVING COUNT(*) > 1;
```

---

**Última actualización:** 2026-03-22
