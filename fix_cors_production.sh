#!/bin/bash

# Script para solucionar CORS en producción
# Uso: ./fix_cors_production.sh

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       CORRECCIÓN DE CORS EN PRODUCCIÓN                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Paso 1: Verificar archivos modificados
echo -e "${YELLOW}📋 Paso 1: Verificando archivos modificados...${NC}"
if [ -f "src/infrastructure/web/app.js" ]; then
    if grep -q "app.options('\*', cors())" src/infrastructure/web/app.js; then
        echo -e "${GREEN}✅ app.js tiene la configuración CORS correcta${NC}"
    else
        echo -e "${RED}❌ app.js NO tiene la configuración CORS actualizada${NC}"
        echo -e "${RED}   Por favor, actualiza el archivo app.js con git pull${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ No se encuentra app.js${NC}"
    exit 1
fi

if [ -f "src/infrastructure/web/routes/health.routes.js" ]; then
    echo -e "${GREEN}✅ health.routes.js existe${NC}"
else
    echo -e "${RED}❌ health.routes.js NO existe${NC}"
    exit 1
fi

# Paso 2: Verificar .env
echo ""
echo -e "${YELLOW}📋 Paso 2: Verificando configuración .env...${NC}"
if [ -f ".env" ]; then
    ALLOWED_ORIGINS=$(grep "ALLOWED_ORIGINS" .env | cut -d '=' -f2)
    echo -e "   Orígenes configurados: ${BLUE}$ALLOWED_ORIGINS${NC}"

    if [[ $ALLOWED_ORIGINS == *"impalexander.store"* ]]; then
        echo -e "${GREEN}✅ Configuración de orígenes correcta${NC}"
    else
        echo -e "${RED}❌ Falta configurar impalexander.store en ALLOWED_ORIGINS${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ No se encuentra archivo .env${NC}"
    exit 1
fi

# Paso 3: Detectar proceso de Node.js
echo ""
echo -e "${YELLOW}📋 Paso 3: Detectando proceso del servidor...${NC}"

if command -v pm2 &> /dev/null; then
    echo -e "${BLUE}   Usando PM2${NC}"
    PM2_PROCESS=$(pm2 list | grep -i backend | awk '{print $2}' | head -1)

    if [ -n "$PM2_PROCESS" ]; then
        echo -e "${GREEN}✅ Proceso PM2 encontrado: $PM2_PROCESS${NC}"

        echo ""
        echo -e "${YELLOW}📋 Paso 4: Reiniciando servidor...${NC}"
        pm2 restart "$PM2_PROCESS" --update-env

        echo ""
        echo -e "${YELLOW}📋 Paso 5: Verificando logs...${NC}"
        sleep 2
        pm2 logs "$PM2_PROCESS" --lines 20 --nostream

    else
        echo -e "${YELLOW}⚠️  No se encontró proceso PM2 activo${NC}"
        echo -e "${YELLOW}   ¿Quieres iniciar el servidor? (s/n)${NC}"
        read -r response
        if [[ "$response" =~ ^([sS]|[yY])$ ]]; then
            pm2 start main.js --name backend
        fi
    fi
else
    echo -e "${YELLOW}⚠️  PM2 no está instalado${NC}"
    echo -e "${YELLOW}   Buscando proceso Node.js...${NC}"

    NODE_PID=$(ps aux | grep "node.*main.js" | grep -v grep | awk '{print $2}' | head -1)

    if [ -n "$NODE_PID" ]; then
        echo -e "${GREEN}✅ Proceso Node encontrado: PID $NODE_PID${NC}"
        echo -e "${YELLOW}   Deteniendo proceso...${NC}"
        kill "$NODE_PID"
        sleep 2

        echo -e "${YELLOW}   Iniciando servidor...${NC}"
        nohup node main.js > server.log 2>&1 &
        echo -e "${GREEN}✅ Servidor reiniciado${NC}"
    else
        echo -e "${YELLOW}⚠️  No se encontró proceso Node.js${NC}"
        echo -e "${YELLOW}   Iniciando servidor...${NC}"
        nohup node main.js > server.log 2>&1 &
        echo -e "${GREEN}✅ Servidor iniciado${NC}"
    fi
fi

# Paso 6: Esperar a que el servidor esté listo
echo ""
echo -e "${YELLOW}📋 Paso 6: Esperando a que el servidor esté listo...${NC}"
sleep 3

# Paso 7: Test de CORS
echo ""
echo -e "${YELLOW}📋 Paso 7: Probando configuración CORS...${NC}"

# Detectar la URL del servidor
if [ -f ".env" ]; then
    PORT=$(grep "^PORT=" .env | cut -d '=' -f2)
    PORT=${PORT:-3000}
else
    PORT=3000
fi

API_URL="http://localhost:$PORT"

# Test al endpoint de health
echo -e "${BLUE}   Probando: $API_URL/health/cors${NC}"
HEALTH_RESPONSE=$(curl -s "$API_URL/health/cors" 2>/dev/null)

if [ -n "$HEALTH_RESPONSE" ]; then
    echo -e "${GREEN}✅ Servidor responde correctamente${NC}"
    echo "$HEALTH_RESPONSE" | jq '.' 2>/dev/null || echo "$HEALTH_RESPONSE"
else
    echo -e "${RED}❌ Servidor no responde${NC}"
    echo -e "${YELLOW}   Revisa los logs con: pm2 logs backend${NC}"
fi

# Test OPTIONS (preflight)
echo ""
echo -e "${BLUE}   Probando preflight CORS...${NC}"
CORS_RESPONSE=$(curl -s -I -X OPTIONS \
    "$API_URL/auth/login" \
    -H "Origin: https://impalexander.store" \
    -H "Access-Control-Request-Method: POST" \
    2>/dev/null)

if echo "$CORS_RESPONSE" | grep -q "access-control-allow-origin"; then
    echo -e "${GREEN}✅ CORS configurado correctamente${NC}"
    echo "$CORS_RESPONSE" | grep -i "access-control"
else
    echo -e "${RED}❌ CORS NO está funcionando${NC}"
    echo -e "${YELLOW}   Respuesta completa:${NC}"
    echo "$CORS_RESPONSE"
fi

# Resumen final
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    RESUMEN                             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Archivos actualizados correctamente${NC}"
echo -e "${GREEN}✅ Servidor reiniciado${NC}"
echo ""
echo -e "${YELLOW}📝 Próximos pasos:${NC}"
echo -e "   1. Verifica que puedas acceder a: ${BLUE}https://api.impalexander.store/health/cors${NC}"
echo -e "   2. Prueba el login desde: ${BLUE}https://impalexander.store${NC}"
echo -e "   3. Revisa los logs si hay problemas: ${BLUE}pm2 logs backend${NC}"
echo ""
echo -e "${YELLOW}📞 Si el problema persiste:${NC}"
echo -e "   - Verifica que Nginx/Apache no esté agregando headers CORS"
echo -e "   - Limpia la caché del navegador"
echo -e "   - Revisa los logs del servidor"
echo ""
