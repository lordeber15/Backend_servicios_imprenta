#!/bin/bash

# Script para probar configuración CORS
# Uso: ./test_cors.sh [URL_API]

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# URL de la API (usa la proporcionada o la de producción por defecto)
API_URL="${1:-https://api.impalexander.store}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          TEST DE CONFIGURACIÓN CORS                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}API URL:${NC} $API_URL"
echo ""

# Función para hacer test
test_cors() {
    local origin=$1
    local endpoint=$2
    local expected=$3

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Probando:${NC} $origin → $endpoint"
    echo ""

    # Hacer request OPTIONS (preflight)
    response=$(curl -s -I -X OPTIONS \
        "$API_URL$endpoint" \
        -H "Origin: $origin" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type,Authorization")

    # Verificar header Access-Control-Allow-Origin
    allow_origin=$(echo "$response" | grep -i "access-control-allow-origin" | tr -d '\r')

    if [ -n "$allow_origin" ]; then
        if [ "$expected" = "PERMITIDO" ]; then
            echo -e "${GREEN}✅ CORRECTO:${NC} CORS permitido"
            echo -e "   $allow_origin"
        else
            echo -e "${RED}❌ ERROR:${NC} CORS permitido pero debería estar bloqueado"
            echo -e "   $allow_origin"
        fi
    else
        if [ "$expected" = "BLOQUEADO" ]; then
            echo -e "${GREEN}✅ CORRECTO:${NC} CORS bloqueado (como se esperaba)"
        else
            echo -e "${RED}❌ ERROR:${NC} CORS bloqueado pero debería estar permitido"
        fi
    fi

    # Mostrar otros headers importantes
    echo ""
    echo -e "${BLUE}Headers CORS:${NC}"
    echo "$response" | grep -i "access-control" | sed 's/^/   /'
    echo ""
}

# Tests
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   TESTS DE ORÍGENES PERMITIDOS (deben pasar)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

test_cors "https://impalexander.store" "/auth/login" "PERMITIDO"
test_cors "https://www.impalexander.store" "/auth/login" "PERMITIDO"

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   TESTS DE ORÍGENES NO PERMITIDOS (deben fallar)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

test_cors "https://malicioso.com" "/auth/login" "BLOQUEADO"
test_cors "https://hackerman.com" "/auth/login" "BLOQUEADO"

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   TEST DE ENDPOINT COMPLETO (con POST real)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Probando POST real a /auth/login...${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST \
    "$API_URL/auth/login" \
    -H "Origin: https://impalexander.store" \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test"}')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo -e "HTTP Status: $http_code"
if [ "$http_code" = "200" ] || [ "$http_code" = "401" ] || [ "$http_code" = "400" ]; then
    echo -e "${GREEN}✅ Servidor responde correctamente${NC}"
else
    echo -e "${RED}❌ Código de estado inesperado${NC}"
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                 FIN DE TESTS                           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
