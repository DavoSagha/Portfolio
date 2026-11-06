#!/usr/bin/env bash
# Construye y levanta producción, y después limpia la caché de Docker para no llenar el disco.
# Nunca borra volúmenes. Si el despliegue falla, conserva la caché para reintentar más rápido.
#
#   bash scripts/server/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/../.."
[ -f .env ] || { echo "Falta el .env: ver docs/deploy.md." >&2; exit 1; }
[ "$(stat -c %a .env)" = 600 ] || { echo "El .env tiene que tener permisos 600: chmod 600 .env" >&2; exit 1; }

docker compose -f compose.yaml -f compose.prod.yaml up -d --build --wait

echo "== Limpieza: caché de construcción e imágenes sin etiqueta"
docker image prune -f > /dev/null
docker builder prune -af > /dev/null

docker compose -f compose.yaml -f compose.prod.yaml ps --format 'table {{.Service}}\t{{.Status}}'
docker system df
df -h /
