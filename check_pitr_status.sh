#!/bin/bash

# Script para verificar si PostgreSQL tiene PITR configurado
# Point-in-Time Recovery permite restaurar la BD a un momento específico

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    VERIFICACIÓN DE POINT-IN-TIME RECOVERY (PITR)      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Detectar usuario y base de datos desde .env
if [ -f ".env" ]; then
    DB_USER=$(grep "^DB_USER=" .env | cut -d '=' -f2)
    DB_NAME=$(grep "^DB_NAME=" .env | cut -d '=' -f2)
else
    DB_USER="admin2025"
    DB_NAME="servicios"
fi

echo -e "${YELLOW}📋 Configuración detectada:${NC}"
echo -e "   Usuario: ${BLUE}$DB_USER${NC}"
echo -e "   Base de datos: ${BLUE}$DB_NAME${NC}"
echo ""

# Verificar configuración de archiving
echo -e "${YELLOW}1. Verificando configuración de archiving WAL...${NC}"

ARCHIVE_MODE=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SHOW archive_mode;" 2>/dev/null | xargs)
ARCHIVE_COMMAND=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SHOW archive_command;" 2>/dev/null | xargs)
WAL_LEVEL=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SHOW wal_level;" 2>/dev/null | xargs)

echo -e "   archive_mode: ${BLUE}$ARCHIVE_MODE${NC}"
echo -e "   wal_level: ${BLUE}$WAL_LEVEL${NC}"
echo -e "   archive_command: ${BLUE}$ARCHIVE_COMMAND${NC}"
echo ""

# Evaluar estado de PITR
if [ "$ARCHIVE_MODE" = "on" ] && [ "$WAL_LEVEL" = "replica" ] && [ "$ARCHIVE_COMMAND" != "(disabled)" ]; then
    echo -e "${GREEN}✅ PITR está CONFIGURADO correctamente${NC}"
    PITR_ENABLED=true
else
    echo -e "${RED}❌ PITR NO está configurado${NC}"
    PITR_ENABLED=false
fi

echo ""

# Verificar directorio de archivos WAL
echo -e "${YELLOW}2. Verificando directorio de archivos WAL...${NC}"

DATA_DIR=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SHOW data_directory;" 2>/dev/null | xargs)
WAL_DIR="$DATA_DIR/pg_wal"

if [ -d "$WAL_DIR" ]; then
    WAL_COUNT=$(ls "$WAL_DIR" 2>/dev/null | wc -l)
    echo -e "   Directorio WAL: ${BLUE}$WAL_DIR${NC}"
    echo -e "   Archivos WAL: ${BLUE}$WAL_COUNT${NC}"

    if [ "$WAL_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✅ Archivos WAL encontrados${NC}"
    else
        echo -e "${YELLOW}⚠️  No hay archivos WAL${NC}"
    fi
else
    echo -e "${RED}❌ No se puede acceder al directorio WAL${NC}"
fi

echo ""

# Verificar backups existentes
echo -e "${YELLOW}3. Verificando backups existentes...${NC}"

BACKUP_DIR="/var/backups/postgresql"
if [ -d "$BACKUP_DIR" ]; then
    BACKUP_COUNT=$(ls "$BACKUP_DIR"/*.sql 2>/dev/null | wc -l)
    echo -e "   Directorio de backups: ${BLUE}$BACKUP_DIR${NC}"
    echo -e "   Backups encontrados: ${BLUE}$BACKUP_COUNT${NC}"

    if [ "$BACKUP_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✅ Backups encontrados${NC}"
        echo ""
        echo -e "${BLUE}   Últimos 5 backups:${NC}"
        ls -lht "$BACKUP_DIR"/*.sql 2>/dev/null | head -5 | awk '{print "   " $9 " (" $5 ")"}'
    else
        echo -e "${YELLOW}⚠️  No hay backups${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Directorio de backups no existe${NC}"
fi

echo ""

# Resumen
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    RESUMEN                             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$PITR_ENABLED" = true ]; then
    echo -e "${GREEN}✅ Point-in-Time Recovery: HABILITADO${NC}"
    echo -e "${GREEN}✅ Puedes restaurar la BD a cualquier momento${NC}"
    echo ""
    echo -e "${YELLOW}📝 Para restaurar a un punto específico:${NC}"
    echo -e "   1. Detener PostgreSQL"
    echo -e "   2. Restaurar backup base"
    echo -e "   3. Configurar recovery.conf"
    echo -e "   4. Iniciar PostgreSQL"
else
    echo -e "${RED}❌ Point-in-Time Recovery: DESHABILITADO${NC}"
    echo -e "${YELLOW}⚠️  Solo puedes restaurar desde backups completos${NC}"
    echo ""
    echo -e "${YELLOW}📝 Para habilitar PITR:${NC}"
    echo -e "   1. Editar postgresql.conf"
    echo -e "   2. Configurar archive_mode = on"
    echo -e "   3. Configurar archive_command"
    echo -e "   4. Reiniciar PostgreSQL"
    echo ""
    echo -e "${BLUE}   Ver: ./setup_pitr.sh${NC}"
fi

echo ""

# Recomendaciones
echo -e "${YELLOW}💡 Recomendaciones:${NC}"
echo ""

if [ "$PITR_ENABLED" = false ]; then
    echo -e "   1. ${RED}Configurar PITR para mayor seguridad${NC}"
    echo -e "   2. Crear backups automáticos diarios"
    echo -e "   3. Guardar backups en ubicación externa"
else
    echo -e "   1. ${GREEN}Mantener backups base regulares (diarios)${NC}"
    echo -e "   2. Monitorear espacio en disco para archivos WAL"
    echo -e "   3. Configurar limpieza automática de archivos antiguos"
fi

echo ""
echo -e "${BLUE}📞 Crear backup ahora: ${NC}./create_backup.sh"
echo ""
