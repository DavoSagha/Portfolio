#!/bin/sh
# Backup de la base y de los archivos en un solo paquete cifrado.
# Variables: ver .env.example. No imprime contraseñas ni contenido.
set -euo pipefail

: "${BACKUP_AGE_RECIPIENT:?Falta BACKUP_AGE_RECIPIENT: sin clave pública no se puede cifrar}"
: "${PGHOST:?}" "${PGUSER:?}" "${PGDATABASE:?}" "${PGPASSWORD:?}"

backups_dir="${BACKUPS_DIR:-/backups}"
uploads_dir="${UPLOADS_DIR:-/data/uploads}"
keep_local="${BACKUP_KEEP_LOCAL:-14}"
keep_remote_days="${BACKUP_KEEP_REMOTE_DAYS:-90}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
name="portfolio-${stamp}.tar.age"

work="$(mktemp -d)"
trap 'rm -rf "$work"; rm -f "$backups_dir/.$name.partial"' EXIT
umask 077

echo "[backup] Volcando la base…"
pg_dump --format=custom --no-owner --no-privileges --file="$work/db.dump"
# Un dump que no se puede listar está dañado: mejor fallar ahora que el día de restaurar.
pg_restore --list "$work/db.dump" > /dev/null

echo "[backup] Empaquetando los archivos…"
tar -C "$uploads_dir" -czf "$work/uploads.tar.gz" .

(cd "$work" && sha256sum db.dump uploads.tar.gz > SHA256SUMS)

echo "[backup] Cifrando…"
tar -C "$work" -cf - db.dump uploads.tar.gz SHA256SUMS \
  | age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" --output "$backups_dir/.$name.partial"
# Mover es atómico: un backup interrumpido nunca queda con el nombre definitivo.
mv "$backups_dir/.$name.partial" "$backups_dir/$name"

# Conserva los más recientes. El nombre lleva la fecha, así que ordenar por nombre alcanza.
ls -1 "$backups_dir"/portfolio-*.tar.age | sort -r | tail -n "+$((keep_local + 1))" | while read -r old; do
  rm -f "$old"
done

if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  echo "[backup] Copiando al destino externo…"
  rclone copyto "$backups_dir/$name" "$BACKUP_RCLONE_REMOTE/$name"
  # El destino externo es la copia de seguridad real: se poda solo si la copia salió bien.
  rclone delete --min-age "${keep_remote_days}d" --include 'portfolio-*.tar.age' "$BACKUP_RCLONE_REMOTE"
else
  echo "[backup] AVISO: sin BACKUP_RCLONE_REMOTE, el backup queda solo en este servidor."
fi

date +%s > "$backups_dir/.last-success"

# Monitoreo: un servicio externo avisa si este ping deja de llegar.
if [ -n "${BACKUP_HEARTBEAT_URL:-}" ]; then
  wget -q -T 15 -O /dev/null "$BACKUP_HEARTBEAT_URL" || echo "[backup] AVISO: el ping de monitoreo falló."
fi

echo "[backup] Listo: $name ($(du -h "$backups_dir/$name" | cut -f1))."
