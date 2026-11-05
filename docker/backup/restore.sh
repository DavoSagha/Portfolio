#!/bin/sh
# Restaura un backup: REEMPLAZA toda la base y todos los archivos.
#
# Uso, con la API y la web detenidas (ver docs/deploy.md):
#   docker compose ... run --rm -it -v "$PWD/age.key:/run/age.key:ro" backup \
#     restore /backups/portfolio-AAAAMMDDTHHMMSSZ.tar.age
#
# Primero verifica todo lo que puede sin tocar nada: la clave, las sumas y el dump.
# RESTORE_CONFIRM=SI evita la pregunta (solo para las pruebas automáticas).
set -euo pipefail

file="${1:?Uso: restore <archivo.tar.age>}"
key="${BACKUP_AGE_KEY_FILE:-/run/age.key}"
uploads_dir="${UPLOADS_DIR:-/data/uploads}"

[ -f "$file" ] || { echo "No existe el backup: $file" >&2; exit 1; }
[ -f "$key" ] || { echo "No existe la clave privada: $key" >&2; exit 1; }
: "${PGHOST:?}" "${PGUSER:?}" "${PGDATABASE:?}" "${PGPASSWORD:?}"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
umask 077

echo "[restore] Descifrando y verificando…"
age --decrypt --identity "$key" "$file" | tar -C "$work" -xf -
(cd "$work" && sha256sum -c SHA256SUMS > /dev/null)
pg_restore --list "$work/db.dump" > /dev/null
tar -tzf "$work/uploads.tar.gz" > /dev/null
echo "[restore] El backup está íntegro."

if [ "${RESTORE_CONFIRM:-}" != "SI" ]; then
  printf 'Esto reemplaza TODA la base "%s" y TODOS los archivos. Escribí SI para continuar: ' "$PGDATABASE"
  read -r answer
  [ "$answer" = "SI" ] || { echo "Cancelado. No se cambió nada."; exit 1; }
fi

echo "[restore] Restaurando la base…"
# En una sola transacción: si algo falla, la base queda como estaba.
{
  echo 'BEGIN;'
  echo 'DROP SCHEMA public CASCADE;'
  echo 'CREATE SCHEMA public;'
  pg_restore --no-owner --no-privileges --file=- "$work/db.dump"
  echo 'COMMIT;'
} | PGOPTIONS='-c client_min_messages=warning' psql --set ON_ERROR_STOP=1 --quiet --output=/dev/null

echo "[restore] Restaurando los archivos…"
find "$uploads_dir" -mindepth 1 -delete
tar -C "$uploads_dir" -xzf "$work/uploads.tar.gz"
# La API corre con el usuario node (uid 1000) de su imagen.
chown -R 1000:1000 "$uploads_dir"

echo "[restore] Listo. Iniciá la API y la web."
