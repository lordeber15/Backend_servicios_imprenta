#!/bin/bash
# Atajo para correr pruebas en el entorno AISLADO (docker-compose.test.yml):
# red sin Internet, Postgres/Redis desechables y certificado autofirmado.
# Ya no usa postgres_db, storage ni el certificado reales.
#
# Uso (desde Backend_servicios_imprenta/):
#   tests/integracion/correr.sh              # unitarias + todas las de integración
#   tests/integracion/correr.sh caja sesion  # solo esas pruebas de integración
set -euo pipefail
cd "$(dirname "$0")/../.."
trap 'docker compose -f docker-compose.test.yml down -v --remove-orphans >/dev/null 2>&1' EXIT
if [ $# -eq 0 ]; then
  docker compose -f docker-compose.test.yml run --rm --build pruebas
else
  docker compose -f docker-compose.test.yml run --rm --build pruebas node tests/integracion/ejecutar.js "$@"
fi
