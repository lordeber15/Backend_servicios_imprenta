# 🚀 Guía Rápida: Importación de XML a Base de Datos

## ✅ Archivos Creados

1. **[import_xml_to_db.js](import_xml_to_db.js)** - Importador principal de XML
2. **[verify_imported_data.js](verify_imported_data.js)** - Verificador de datos importados
3. **[migrate_metodo_pago_comprobantes.js](migrate_metodo_pago_comprobantes.js)** - Migración de método de pago
4. **[IMPORTAR_XML.md](IMPORTAR_XML.md)** - Documentación detallada de importación
5. **[MIGRACION_VENTAS_CAJA.md](MIGRACION_VENTAS_CAJA.md)** - Documentación de migración de ventas

---

## 🎯 Uso en Producción

### **Paso 1: Instalar dependencias**

```bash
cd /home/appimprenta/Backend/Backend_servicios_imprenta
npm install xml2js
```

### **Paso 2: Subir archivos al servidor**

```bash
# Desde tu máquina local
scp import_xml_to_db.js usuario@servidor:/home/appimprenta/Backend/Backend_servicios_imprenta/
scp verify_imported_data.js usuario@servidor:/home/appimprenta/Backend/Backend_servicios_imprenta/
scp migrate_metodo_pago_comprobantes.js usuario@servidor:/home/appimprenta/Backend/Backend_servicios_imprenta/
```

### **Paso 3: Importar XML**

```bash
# En el servidor
cd /home/appimprenta/Backend/Backend_servicios_imprenta
node import_xml_to_db.js
```

### **Paso 4: Migrar método de pago**

```bash
# Para que los comprobantes se sumen en la caja
echo "si" | node migrate_metodo_pago_comprobantes.js
```

### **Paso 5: Verificar**

```bash
node verify_imported_data.js
```

---

## 📊 ¿Qué hace cada script?

### `import_xml_to_db.js`

- ✅ Lee archivos XML de `storage/xml/`
- ✅ Crea automáticamente: Clientes, Series, Comprobantes, Detalles
- ✅ Asigna `metodo_pago = "Efectivo"` automáticamente
- ✅ Omite duplicados
- ✅ Muestra progreso en tiempo real

### `migrate_metodo_pago_comprobantes.js`

- ✅ Actualiza comprobantes importados anteriormente (sin metodo_pago)
- ✅ Asigna `metodo_pago` basándose en `forma_pago`
- ✅ Muestra vista previa antes de confirmar
- ✅ Necesario para que comprobantes se sumen en caja

### `verify_imported_data.js`

- ✅ Muestra resumen de comprobantes, series y clientes
- ✅ Detecta problemas de integridad
- ✅ Busca duplicados
- ✅ Muestra totales por tipo de comprobante

---

## 💡 Comandos Más Usados

```bash
# Importar todos los XML
node import_xml_to_db.js

# Verificar datos
node verify_imported_data.js

# Migrar método de pago (solo si es necesario)
echo "si" | node migrate_metodo_pago_comprobantes.js

# Ver archivos XML disponibles
ls -lh storage/xml/*.xml

# Contar comprobantes en BD
psql -U admin2025 -d servicios -c "SELECT COUNT(*) FROM \"Comprobante\";"
```

---

## 🔍 Verificación Post-Importación

Después de importar, ejecuta:

```bash
node verify_imported_data.js
```

**Busca estos indicadores:**

✅ **Bueno:**
```
Comprobantes sin metodo_pago:  ✅ 0
Comprobantes sin cliente:      ✅ 0
Comprobantes sin serie_id:     ✅ 0
No se encontraron duplicados   ✅
```

⚠️ **Requiere atención:**
```
Comprobantes sin metodo_pago:  ⚠️  12  ← Ejecutar migración
Comprobantes sin detalles:     ⚠️  2   ← Normal si son guías
```

---

## 📈 Ejemplo Completo

```bash
# 1. Conectar al servidor
ssh usuario@servidor

# 2. Ir al directorio
cd /home/appimprenta/Backend/Backend_servicios_imprenta

# 3. Instalar dependencias
npm install xml2js

# 4. Importar XML
node import_xml_to_db.js

# Salida:
# ╔═══════════════════════════════════════════════════════════╗
# ║     IMPORTADOR DE COMPROBANTES DESDE XML (UBL 2.1)       ║
# ╚═══════════════════════════════════════════════════════════╝
#
# 📋 Archivos encontrados: 12
#
# 📄 Procesando: 20608582011-01-F001-00000011.xml
#    ✅ Cliente creado: 20608582011 - Imprenta alexander
#    ✅ Serie creada: 01-F001 (correlativo: 11)
#    ✅ Comprobante creado: F001-00000011 | Total: S/ 100
#    ✅ 1 detalle(s) insertado(s)
#
# ✅ Comprobantes creados:  12
# ⏭️  Comprobantes omitidos: 0 (ya existían)
# ❌ Errores:               0

# 5. Verificar
node verify_imported_data.js

# 6. Migrar método de pago (si es necesario)
echo "si" | node migrate_metodo_pago_comprobantes.js

# 7. Verificar caja
curl http://localhost:3000/caja/actual | jq
```

---

## 🚨 Troubleshooting

### Error: "xml2js not found"

```bash
npm install xml2js
```

### Error: "Cannot connect to database"

```bash
# Verificar .env
cat .env | grep DB_

# Verificar PostgreSQL
sudo systemctl status postgresql
```

### Comprobantes no se suman en caja

```bash
# Verificar que tengan metodo_pago
node verify_imported_data.js | grep "metodo_pago"

# Si dice "⚠️ 12", ejecutar migración
echo "si" | node migrate_metodo_pago_comprobantes.js
```

### XML con formato incorrecto

Los archivos XML deben seguir el formato:
```
{RUC}-{TIPO}-{SERIE}-{CORRELATIVO}.xml

Ejemplo: 20608582011-01-F001-00000011.xml
         ^^^^^^^^^^^-^^-^^^^-^^^^^^^^
         RUC         |  |    Correlativo
                     |  Serie
                     Tipo (01=Factura)
```

---

## 📚 Documentación Completa

- **Importación de XML:** [IMPORTAR_XML.md](IMPORTAR_XML.md)
- **Migración de Ventas:** [MIGRACION_VENTAS_CAJA.md](MIGRACION_VENTAS_CAJA.md)

---

## ✨ Características

✅ **Automático:** Importa todo con un solo comando
✅ **Inteligente:** Crea clientes y series automáticamente
✅ **Seguro:** No duplica comprobantes
✅ **Completo:** Importa cabecera + detalles
✅ **Verificable:** Incluye herramientas de verificación
✅ **Suma en Caja:** Asigna metodo_pago automáticamente

---

**Última actualización:** 2026-03-22
