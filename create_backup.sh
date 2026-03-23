#!/bin/bash

# Script para crear backup completo de PostgreSQL
# Crea backup en formato SQL con timestamp

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           CREAR BACKUP DE POSTGRESQL                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Leer configuración desde .env
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
    echo -e "${GREEN}✅ Configuración cargada desde .env${NC}"
else
    echo -e "${RED}❌ Archivo .env no encontrado${NC}"
    exit 1
fi

# Variables
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_backup_${TIMESTAMP}.sql"
BACKUP_COMPRESSED="${BACKUP_FILE}.gz"

# Crear directorio de backups si no existe
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}📋 Configuración de backup:${NC}"
echo -e "   Base de datos: ${BLUE}${DB_NAME}${NC}"
echo -e "   Usuario: ${BLUE}${DB_USER}${NC}"
echo -e "   Archivo: ${BLUE}${BACKUP_FILE}${NC}"
echo ""

# Preguntar si incluir datos
echo -e "${YELLOW}¿Qué deseas respaldar?${NC}"
echo -e "   1) Solo estructura (schema)"
echo -e "   2) Solo datos"
echo -e "   3) Todo (estructura + datos) [Recomendado]"
read -p "Opción [3]: " BACKUP_TYPE
BACKUP_TYPE=${BACKUP_TYPE:-3}

# Configurar opciones de pg_dump
case $BACKUP_TYPE in
    1)
        DUMP_OPTIONS="--schema-only"
        echo -e "${BLUE}   Creando backup de estructura...${NC}"
        ;;
    2)
        DUMP_OPTIONS="--data-only"
        echo -e "${BLUE}   Creando backup de datos...${NC}"
        ;;
    *)
        DUMP_OPTIONS=""
        echo -e "${BLUE}   Creando backup completo...${NC}"
        ;;
esac

echo ""

# Crear backup
echo -e "${YELLOW}🔄 Creando backup...${NC}"

PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    $DUMP_OPTIONS \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    -f "$BACKUP_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backup creado exitosamente${NC}"

    # Mostrar tamaño del archivo
    FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "   Tamaño: ${BLUE}$FILESIZE${NC}"

    # Preguntar si comprimir
    echo ""
    read -p "¿Comprimir el backup? (s/n) [s]: " COMPRESS
    COMPRESS=${COMPRESS:-s}

    if [[ "$COMPRESS" =~ ^[sS]$ ]]; then
        echo -e "${YELLOW}🔄 Comprimiendo backup...${NC}"
        gzip "$BACKUP_FILE"

        if [ $? -eq 0 ]; then
            COMPRESSED_SIZE=$(du -h "$BACKUP_COMPRESSED" | cut -f1)
            echo -e "${GREEN}✅ Backup comprimido${NC}"
            echo -e "   Tamaño comprimido: ${BLUE}$COMPRESSED_SIZE${NC}"
            echo -e "   Archivo: ${BLUE}$BACKUP_COMPRESSED${NC}"
        else
            echo -e "${RED}❌ Error al comprimir${NC}"
        fi
    fi

    # Listar backups existentes
    echo ""
    echo -e "${YELLOW}📊 Backups existentes:${NC}"
    ls -lht "$BACKUP_DIR" | head -6 | tail -5 | awk '{print "   " $9 " (" $5 ")"}'

    # Calcular espacio total de backups
    TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
    echo ""
    echo -e "   Espacio total de backups: ${BLUE}$TOTAL_SIZE${NC}"

    # Preguntar si limpiar backups antiguos
    BACKUP_COUNT=$(ls "$BACKUP_DIR"/*.sql* 2>/dev/null | wc -l)
    if [ "$BACKUP_COUNT" -gt 10 ]; then
        echo ""
        echo -e "${YELLOW}⚠️  Tienes $BACKUP_COUNT backups${NC}"
        read -p "¿Eliminar backups con más de 30 días? (s/n) [n]: " CLEANUP
        if [[ "$CLEANUP" =~ ^[sS]$ ]]; then
            find "$BACKUP_DIR" -name "*.sql*" -mtime +30 -delete
            echo -e "${GREEN}✅ Backups antiguos eliminados${NC}"
        fi
    fi

else
    echo -e "${RED}❌ Error al crear backup${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                   BACKUP COMPLETADO                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ -f "$BACKUP_COMPRESSED" ]; then
    FINAL_FILE="$BACKUP_COMPRESSED"
else
    FINAL_FILE="$BACKUP_FILE"
fi

echo -e "${GREEN}✅ Archivo de backup: ${NC}"
echo -e "   ${BLUE}$FINAL_FILE${NC}"
echo ""
echo -e "${YELLOW}📝 Para restaurar este backup:${NC}"
echo -e "   ${BLUE}./restore_backup.sh $FINAL_FILE${NC}"
echo ""
echo -e "${YELLOW}💡 Recomendación:${NC}"
echo -e "   Copia este backup a una ubicación segura externa"
echo -e "   ${BLUE}scp $FINAL_FILE usuario@servidor-backup:/backups/${NC}"
echo ""
