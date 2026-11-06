#!/bin/sh
# Sin argumentos: programa el backup automático. Con argumentos: ejecuta ese comando
# (por ejemplo `backup` o `restore`).
set -eu

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

: "${BACKUP_AGE_RECIPIENT:?Falta BACKUP_AGE_RECIPIENT: sin clave pública no se puede cifrar}"

schedule="${BACKUP_CRON:-0 6 * * *}"
# crond no hereda el entorno: el script lo carga desde este archivo, solo legible por root.
umask 077
export -p > /run/backup.env
echo "$schedule . /run/backup.env; /usr/local/bin/backup" > /etc/crontabs/root
# Punto de partida del healthcheck: da un período de gracia hasta el primer backup.
date +%s > /run/backup-started

echo "Backups programados: $schedule (UTC)."
exec crond -f -L /dev/stdout
