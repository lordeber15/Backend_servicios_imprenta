#!/usr/bin/env bash
#
# BACKUP AUTOMÁTICO (no interactivo, apto para cron)
#
# Respalda en un único archivo cifrado:
#   - Base de datos completa (pg_dump formato custom, vía el contenedor de Postgres)
#   - storage/xml, storage/cdr  → SUNAT exige conservar XML firmados y CDR
#   - storage/certs, storage/keys → certificado digital y llaves QZ
#   - src/uploads               → logos y fotos de perfil
#
# Cifrado con `age` usando una CLAVE PÚBLICA: el servidor puede cifrar pero NO
# descifrar sus propios backups. La clave privada se guarda fuera del servidor
# (gestor de contraseñas / USB). Si roban el servidor, los backups no sirven.
#
# Configuración (en .env o en el entorno):
#   BACKUP_AGE_RECIPIENT  Clave pública age (age1...). OBLIGATORIA.
#   BACKUP_DIR            Carpeta destino local      (default: ./backups)
#   BACKUP_RETENCION_DIAS Días a conservar en local  (default: 30)
#   BACKUP_REMOTO         Destino rsync opcional, p. ej. usuario@host:/backups/imprenta
#   PG_CONTAINER          Contenedor de Postgres     (default: postgres_db)
#
# Cron (diario 02:30):
#   30 2 * * * cd /ruta/Backend_servicios_imprenta && ./backup_automatico.sh >> backups/backup.log 2>&1
#
# Restaurar:
#   age -d -i clave-privada.txt backup.tar.age | tar -x -C /tmp/restaurar
#   docker exec -i postgres_db pg_restore -U <user> -d <db> --clean --if-exists < /tmp/restaurar/db.dump

set -euo pipefail
umask 077
cd "$(dirname "$0")"

# Lee solo las claves necesarias del .env, sin ejecutarlo como shell.
leer_env() {
  local clave="$1"
  [ -f .env ] || return 0
  # `|| true`: una clave ausente no debe abortar el script por pipefail.
  { grep -E "^${clave}=" .env || true; } | tail -1 | cut -d= -f2- | sed -E 's/^["'\'']//; s/["'\'']$//'
}

for v in DB_NAME DB_USER DB_PASSWORD BACKUP_AGE_RECIPIENT BACKUP_DIR BACKUP_RETENCION_DIAS BACKUP_REMOTO PG_CONTAINER; do
  if [ -z "${!v:-}" ]; then
    valor="$(leer_env "$v")"
    [ -n "$valor" ] && printf -v "$v" '%s' "$valor"
  fi
done

BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENCION_DIAS="${BACKUP_RETENCION_DIAS:-30}"
PG_CONTAINER="${PG_CONTAINER:-postgres_db}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
fallar() { log "ERROR: $*"; exit 1; }

command -v age >/dev/null || fallar "age no está instalado (brew install age / apt install age)"
[ -n "${BACKUP_AGE_RECIPIENT:-}" ] || fallar "Defina BACKUP_AGE_RECIPIENT (clave pública age1...)"
[ -n "${DB_NAME:-}" ] && [ -n "${DB_USER:-}" ] || fallar "Faltan DB_NAME / DB_USER"

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d_%H%M%S)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

log "Volcando base de datos ${DB_NAME}..."
docker exec -e PGPASSWORD="${DB_PASSWORD:-}" "$PG_CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc --no-owner --no-acl > "$TMP/db.dump" \
  || fallar "pg_dump falló"
[ -s "$TMP/db.dump" ] || fallar "el volcado está vacío"

# Solo las rutas que existan (en un entorno nuevo alguna puede faltar).
RUTAS=()
for r in storage/xml storage/cdr storage/certs storage/keys src/uploads; do
  [ -e "$r" ] && RUTAS+=("$r")
done

DESTINO="${BACKUP_DIR}/imprenta_${TS}.tar.age"
log "Empaquetando y cifrando → ${DESTINO}"
tar -c -C "$TMP" db.dump -C "$PWD" "${RUTAS[@]}" \
  | age -r "$BACKUP_AGE_RECIPIENT" -o "$DESTINO" \
  || fallar "no se pudo crear el archivo cifrado"

# Sanidad: el archivo debe tener cabecera age y tamaño > 0.
head -c 21 "$DESTINO" | grep -q "age-encryption.org" || fallar "el archivo no parece cifrado con age"
log "OK: $(du -h "$DESTINO" | cut -f1) (db $(du -h "$TMP/db.dump" | cut -f1); ${RUTAS[*]})"

if [ -n "${BACKUP_REMOTO:-}" ]; then
  log "Copiando a ${BACKUP_REMOTO}..."
  rsync -a --chmod=F600 "$DESTINO" "$BACKUP_REMOTO/" || fallar "rsync remoto falló"
fi

find "$BACKUP_DIR" -name 'imprenta_*.tar.age' -mtime +"$BACKUP_RETENCION_DIAS" -print -delete \
  | sed 's/^/  eliminado (retención): /' || true

log "Backup completado"
