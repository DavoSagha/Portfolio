#!/bin/sh
# Sano si hubo un backup en las últimas 26 horas, o si el servicio arrancó hace menos que eso.
set -eu

limit=$((26 * 60 * 60))
now="$(date +%s)"
last="$(cat "${BACKUPS_DIR:-/backups}/.last-success" 2>/dev/null || cat /run/backup-started)"
[ $((now - last)) -lt "$limit" ]
