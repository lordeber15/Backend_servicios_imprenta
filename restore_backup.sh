#!/bin/bash

# Script para restaurar backup de PostgreSQL
# Uso: ./restore_backup.sh [archivo_backup.sql.gz]

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         RESTAURAR BACKUP DE POSTGRESQL                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verificar archivo de backup
if [ -z "$1" ]; then
    echo -e "${YELLOW}Backups disponibles:${NC}"
    ls -lht ./backups/*.sql* 2>/dev/null | head -10 | awk '{print "   " NR ") " $9 " (" $5 ")"}'
    echo ""
    read -p "Ingresa el número del backup o ruta completa: " BACKUP_INPUT

    if [[ "$BACKUP_INPUT" =~ ^[0-9]+$ ]]; then
        BACKUP_FILE=$(ls -t ./backups/*.sql* 2>/dev/null | sed -n "${BACKUP_INPUT}p")
    else
        BACKUP_FILE="$BACKUP_INPUT"
    fi
else
    BACKUP_FILE="$1"
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Archivo no encontrado: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Archivo de backup: ${BLUE}$BACKUP_FILE${NC}"
echo ""

# Leer configuración
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
else
    echo -e "${RED}❌ Archivo .env no encontrado${NC}"
    exit 1
fi

# ADVERTENCIA
echo -e "${RED}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║                    ⚠️  ADVERTENCIA                     ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Esta operación:${NC}"
echo -e "   ${RED}❌ ELIMINARÁ todos los datos actuales de: ${DB_NAME}${NC}"
echo -e "   ${GREEN}✅ Restaurará los datos desde: $(basename $BACKUP_FILE)${NC}"
echo ""
echo -e "${YELLOW}¿Estás seguro de continuar?${NC}"
read -p "Escribe 'RESTAURAR' para confirmar: " CONFIRM

if [ "$CONFIRM" != "RESTAURAR" ]; then
    echo -e "${YELLOW}⚠️  Operación cancelada${NC}"
    exit 0
fi

# Crear backup de seguridad antes de restaurar
echo ""
echo -e "${YELLOW}🔄 Creando backup de seguridad antes de restaurar...${NC}"
SAFETY_BACKUP="./backups/${DB_NAME}_before_restore_$(date +%Y%m%d_%H%M%S).sql"
PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f "$SAFETY_BACKUP" 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backup de seguridad creado: $SAFETY_BACKUP${NC}"
else
    echo -e "${YELLOW}⚠️  No se pudo crear backup de seguridad${NC}"
    read -p "¿Continuar sin backup de seguridad? (s/n) [n]: " CONTINUE
    if [[ ! "$CONTINUE" =~ ^[sS]$ ]]; then
        echo -e "${YELLOW}⚠️  Operación cancelada${NC}"
        exit 0
    fi
fi

# Descomprimir si es necesario
RESTORE_FILE="$BACKUP_FILE"
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo ""
    echo -e "${YELLOW}🔄 Descomprimiendo backup...${NC}"
    RESTORE_FILE="${BACKUP_FILE%.gz}"
    gunzip -c "$BACKUP_FILE" > "$RESTORE_FILE"
    TEMP_FILE=true
fi

# Detener conexiones activas
echo ""
echo -e "${YELLOW}🔄 Cerrando conexiones activas...${NC}"
PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" 2>&1 > /dev/null

# Restaurar backup
echo -e "${YELLOW}🔄 Restaurando backup...${NC}"
echo -e "   Esto puede tomar varios minutos..."
echo ""

PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f "$RESTORE_FILE" 2>&1 | grep -E "ERROR|WARNING|NOTICE" | head -20

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo -e "${GREEN}✅ Backup restaurado exitosamente${NC}"

    # Limpiar archivo temporal
    if [ "$TEMP_FILE" = true ]; then
        rm "$RESTORE_FILE"
    fi

    # Verificar datos restaurados
    echo ""
    echo -e "${YELLOW}📊 Verificando datos restaurados...${NC}"

    TABLES=$(PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)

    echo -e "   Tablas restauradas: ${BLUE}$TABLES${NC}"

    # Mostrar algunas tablas
    echo ""
    echo -e "${BLUE}   Tablas principales:${NC}"
    PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -c "SELECT table_name, (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns FROM information_schema.tables t WHERE table_schema = 'public' ORDER BY table_name LIMIT 10;" 2>&1 | grep -v "rows)"

else
    echo -e "${RED}❌ Error al restaurar backup${NC}"
    echo -e "${YELLOW}⚠️  Puedes restaurar el backup de seguridad:${NC}"
    echo -e "   ${BLUE}./restore_backup.sh $SAFETY_BACKUP${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              RESTAURACIÓN COMPLETADA                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Base de datos restaurada desde: ${NC}"
echo -e "   ${BLUE}$(basename $BACKUP_FILE)${NC}"
echo ""
echo -e "${YELLOW}📝 Próximos pasos:${NC}"
echo -e "   1. Reiniciar el servidor: ${BLUE}pm2 restart backend${NC}"
echo -e "   2. Verificar que la aplicación funciona"
echo -e "   3. Revisar los logs: ${BLUE}pm2 logs backend${NC}"
echo ""
