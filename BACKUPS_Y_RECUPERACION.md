# 💾 Guía de Backups y Recuperación - PostgreSQL

## 📋 Índice

1. [Point-in-Time Recovery (PITR)](#point-in-time-recovery-pitr)
2. [Crear Backups](#crear-backups)
3. [Restaurar Backups](#restaurar-backups)
4. [Backups Automáticos](#backups-automáticos)
5. [Mejores Prácticas](#mejores-prácticas)

---

## 🔍 Point-in-Time Recovery (PITR)

### ¿Qué es PITR?

Point-in-Time Recovery permite restaurar la base de datos a **cualquier momento específico**, no solo a un backup completo.

**Ejemplo:**
- Backup completo: Domingo 12:00 AM
- Error en producción: Martes 3:45 PM
- **Con PITR**: Puedes restaurar a Martes 3:44 PM (1 minuto antes del error)
- **Sin PITR**: Solo puedes restaurar al Domingo 12:00 AM (pierdes 2+ días de datos)

### Verificar si tienes PITR

```bash
./check_pitr_status.sh
```

**Salida esperada:**

```
✅ PITR está CONFIGURADO correctamente
```

O

```
❌ PITR NO está configurado
```

---

## 💾 Crear Backups

### Backup Manual

```bash
# Backup completo (estructura + datos)
./create_backup.sh

# El script preguntará:
# 1) Solo estructura
# 2) Solo datos
# 3) Todo (recomendado)
```

**Resultado:**
```
✅ Backup creado exitosamente
   Archivo: ./backups/servicios_backup_20260322_143000.sql.gz
   Tamaño comprimido: 15M
```

### Backup Rápido (Comando directo)

```bash
# Cargar variables de .env
export $(grep -v '^#' .env | xargs)

# Crear backup
pg_dump -U $DB_USER -d $DB_NAME -h $DB_HOST -p $DB_PORT \
  > backup_$(date +%Y%m%d_%H%M%S).sql

# Comprimir
gzip backup_*.sql
```

---

## 🔄 Restaurar Backups

### Restauración Interactiva

```bash
./restore_backup.sh

# El script mostrará backups disponibles:
# 1) servicios_backup_20260322_143000.sql.gz (15M)
# 2) servicios_backup_20260321_120000.sql.gz (14M)
#
# Ingresa el número: 1
```

### Restauración Directa

```bash
./restore_backup.sh ./backups/servicios_backup_20260322_143000.sql.gz
```

### ⚠️ IMPORTANTE

- ✅ **Siempre se crea un backup de seguridad antes de restaurar**
- ❌ **La restauración ELIMINA todos los datos actuales**
- ⏸️ **Detiene el servidor durante la restauración**

---

## ⏰ Backups Automáticos

### Configurar con Cron

```bash
# Editar crontab
crontab -e

# Agregar backup diario a las 2:00 AM
0 2 * * * cd /home/appimprenta/Backend/Backend_servicios_imprenta && ./create_backup.sh > /tmp/backup.log 2>&1

# Agregar backup cada 6 horas
0 */6 * * * cd /home/appimprenta/Backend/Backend_servicios_imprenta && ./create_backup.sh > /tmp/backup.log 2>&1

# Limpiar backups antiguos (mantener solo 30 días)
0 3 * * * find /home/appimprenta/Backend/Backend_servicios_imprenta/backups -name "*.sql*" -mtime +30 -delete
```

### Verificar que el cron funciona

```bash
# Ver logs del último backup
tail -f /tmp/backup.log

# Ver crons activos
crontab -l
```

---

## 📊 Mejores Prácticas

### 1. Estrategia 3-2-1

- **3** copias de tus datos
- **2** tipos diferentes de almacenamiento
- **1** copia fuera del sitio (offsite)

**Ejemplo:**
```
1. Base de datos en producción (servidor)
2. Backup diario local (mismo servidor)
3. Backup semanal remoto (servidor externo o cloud)
```

### 2. Frecuencia de Backups

| Tipo de Datos | Frecuencia Recomendada |
|---------------|------------------------|
| Datos críticos | Cada hora (PITR) |
| Datos importantes | Diario |
| Datos históricos | Semanal |

### 3. Retención de Backups

```bash
# Mantener:
# - Diarios: 7 días
# - Semanales: 4 semanas
# - Mensuales: 6 meses

# Script de limpieza automática
find ./backups -name "*.sql*" -mtime +7 -delete    # Más de 7 días
find ./backups -name "*weekly*.sql*" -mtime +28 -delete  # Más de 4 semanas
find ./backups -name "*monthly*.sql*" -mtime +180 -delete # Más de 6 meses
```

### 4. Verificar Backups Regularmente

```bash
# Una vez al mes, probar restaurar en ambiente de desarrollo
./restore_backup.sh [backup_archivo]
```

### 5. Monitorear Espacio en Disco

```bash
# Ver espacio usado por backups
du -sh ./backups

# Ver espacio disponible
df -h /home/appimprenta

# Configurar alerta si queda menos de 20% de espacio
```

---

## 🚨 Escenarios de Recuperación

### Escenario 1: Error en Migración

```bash
# 1. Antes de migrar
./create_backup.sh

# 2. Ejecutar migración
node fix_enum_conflict.js

# 3. Si algo sale mal
./restore_backup.sh [último_backup]
```

### Escenario 2: Datos Eliminados Accidentalmente

**Con PITR:**
```bash
# Restaurar a 5 minutos antes del error
# (requiere configuración avanzada de PITR)
```

**Sin PITR:**
```bash
# Restaurar al último backup
./restore_backup.sh
# Perderás datos entre el backup y el error
```

### Escenario 3: Servidor Comprometido

```bash
# 1. Detener servidor
pm2 stop all

# 2. Analizar breach

# 3. Restaurar desde backup LIMPIO
./restore_backup.sh [backup_antes_del_breach]

# 4. Cambiar todas las credenciales

# 5. Reiniciar servidor
pm2 restart all
```

---

## 📁 Estructura de Directorios

```
Backend_servicios_imprenta/
├── backups/                          # Backups locales
│   ├── servicios_backup_20260322_143000.sql.gz
│   ├── servicios_backup_20260321_120000.sql.gz
│   └── servicios_before_restore_*.sql  # Backups de seguridad
├── check_pitr_status.sh              # Verificar PITR
├── create_backup.sh                  # Crear backup manual
└── restore_backup.sh                 # Restaurar backup
```

---

## 🔐 Seguridad de Backups

### Encriptar Backups

```bash
# Crear backup encriptado
./create_backup.sh
gpg -c ./backups/servicios_backup_*.sql.gz
# Ingresa contraseña segura

# Desencriptar
gpg -d ./backups/servicios_backup_*.sql.gz.gpg > backup.sql.gz
```

### Subir a Cloud (S3, Google Cloud)

```bash
# AWS S3
aws s3 cp ./backups/servicios_backup_*.sql.gz s3://mi-bucket/backups/

# Google Cloud Storage
gsutil cp ./backups/servicios_backup_*.sql.gz gs://mi-bucket/backups/

# Rsync a servidor remoto
rsync -avz ./backups/ usuario@servidor-backup:/backups/postgresql/
```

---

## ✅ Checklist de Recuperación ante Desastres

Antes de hacer cambios críticos en producción:

- [ ] Crear backup completo
- [ ] Verificar que el backup se creó correctamente
- [ ] Copiar backup a ubicación segura
- [ ] Documentar el cambio que vas a hacer
- [ ] Tener plan de rollback listo
- [ ] Notificar al equipo (si aplica)
- [ ] Ejecutar el cambio
- [ ] Verificar que funcionó
- [ ] Mantener backup por 30 días

---

## 📞 Comandos Rápidos

```bash
# Ver estado de PITR
./check_pitr_status.sh

# Crear backup ahora
./create_backup.sh

# Restaurar último backup
./restore_backup.sh

# Listar backups
ls -lht ./backups/

# Ver tamaño de backups
du -sh ./backups/

# Espacio disponible
df -h
```

---

## 🆘 Troubleshooting

### Error: "pg_dump: command not found"

```bash
# Instalar PostgreSQL client
sudo apt-get install postgresql-client
```

### Error: "permission denied"

```bash
# Dar permisos a los scripts
chmod +x *.sh
```

### Error: "Connection refused"

```bash
# Verificar que PostgreSQL está corriendo
sudo systemctl status postgresql

# Verificar puerto y host en .env
cat .env | grep DB_
```

---

**Última actualización:** 2026-03-22
