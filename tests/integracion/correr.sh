#!/bin/bash
# Ejecuta una prueba de integración en un entorno AISLADO:
#   - BD temporal imprenta_migr_test (migrada desde cero)
#   - Redis temporal "redis_prueba" (ningún worker lo consume: nada llega a SUNAT)
#   - URLs de SUNAT apuntando a beta como resguardo extra
# Al final borra la BD, el Redis y los XML generados (RUC de prueba 20000000001).
#
# IMPORTANTE: el .env local apunta a SUNAT PRODUCCIÓN; no ejecutar pruebas de
# emisión contra la BD/Redis reales.
#
# Uso (desde Desarrollo/, con la imagen del backend construida):
#   Backend_servicios_imprenta/tests/integracion/correr.sh Backend_servicios_imprenta/tests/integracion/caja.prueba.js
set -u
S=$(mktemp -d)
trap 'rm -rf "$S"' EXIT
SCRIPT=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
docker exec -i postgres_db sh -c 'psql -U "$POSTGRES_USER" -d postgres -q -c "DROP DATABASE IF EXISTS imprenta_migr_test WITH (FORCE)" -c "CREATE DATABASE imprenta_migr_test"'
docker run -d --rm --name redis_prueba --network desarrollo_default redis:7-alpine >/dev/null
ls Backend_servicios_imprenta/storage/xml | sort > $S/xml-antes.txt
docker compose run --rm --no-deps -e DB_NAME=imprenta_migr_test migrate 2>&1 | grep "Migraciones aplicadas"
docker compose run --rm --no-deps -e DB_NAME=imprenta_migr_test -e REDIS_HOST=redis_prueba -e REDIS_PASSWORD= \
  -e SUNAT_WS_FACTURAS=https://e-beta.sunat.gob.pe/x -e SUNAT_WS_RESUMEN=https://e-beta.sunat.gob.pe/x -e SUNAT_ENV=beta \
  -v "$SCRIPT":/tmp/prueba.js:ro backend node /tmp/prueba.js 2>&1 | grep -v "dotenv\|Container\|Redis\]\|Logo fallback"
docker stop redis_prueba >/dev/null
ls Backend_servicios_imprenta/storage/xml | sort > $S/xml-despues.txt; comm -13 $S/xml-antes.txt $S/xml-despues.txt > $S/xml-nuevos.txt
if [ -s $S/xml-nuevos.txt ] && [ "$(grep -vc '^20000000001-' $S/xml-nuevos.txt)" = "0" ]; then (cd Backend_servicios_imprenta/storage/xml && xargs rm -f < $S/xml-nuevos.txt); fi
echo "XML de prueba borrados: $(wc -l < $S/xml-nuevos.txt | tr -d ' ')"
docker exec postgres_db sh -c 'psql -U "$POSTGRES_USER" -d postgres -qc "DROP DATABASE imprenta_migr_test WITH (FORCE)"'
find Backend_servicios_imprenta/storage/backups-migracion -name 'imprenta_migr_test-*' -delete
