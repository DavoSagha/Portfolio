#!/usr/bin/env bash
# Genera la clave de los backups fuera del repo. Muestra solo la parte pública.
# La parte privada nunca se imprime: se abre desde tu editor para guardarla en el gestor.
#
#   bash scripts/backup-key-generate.sh [carpeta]   (por defecto, ~/.portfolio-secrets)
set -euo pipefail

DIR="${1:-$HOME/.portfolio-secrets}"
KEY="$DIR/age.key"
PUB="$DIR/age.pub"

# Git Bash mezcla C:/ y /c/: las dos rutas se llevan al mismo formato antes de compararlas.
unix_path() {
  local path
  path="$(realpath -m "$1")"
  if command -v cygpath > /dev/null; then cygpath -u "$path"; else echo "$path"; fi
}
repo_root="$(unix_path "$(git rev-parse --show-toplevel)")"
abs_dir="$(unix_path "$DIR")"
case "$abs_dir/" in
  "$repo_root"/*)
    echo "La clave no puede quedar dentro del repo: $abs_dir" >&2
    exit 1
    ;;
esac
mkdir -p "$abs_dir"

if [ -e "$KEY" ]; then
  echo "Ya existe $KEY y no la piso: los backups cifrados con ella dependen de ese archivo." >&2
  exit 1
fi

docker build -q -f docker/backup/Dockerfile -t portfolio-backup-tools . > /dev/null
umask 077
docker run --rm --entrypoint age-keygen portfolio-backup-tools > "$KEY" 2> /dev/null
chmod 600 "$KEY"
grep -o 'age1[a-z0-9]*' "$KEY" | head -1 > "$PUB"

# Comprueba que el par funciona, sin mostrar la clave. En Windows, docker necesita la ruta nativa.
mount_dir="$abs_dir"
command -v cygpath > /dev/null && mount_dir="$(cygpath -m "$abs_dir")"
EXPECTED="prueba-$RANDOM-$RANDOM"
GOT="$(printf '%s' "$EXPECTED"   | docker run --rm -i --entrypoint age portfolio-backup-tools --encrypt --recipient "$(cat "$PUB")"   | MSYS_NO_PATHCONV=1 docker run --rm -i -v "$mount_dir:/keys:ro" --entrypoint age     portfolio-backup-tools --decrypt --identity /keys/age.key || true)"
if [ "$GOT" != "$EXPECTED" ]; then
  rm -f "$KEY" "$PUB"
  echo "La clave generada no pudo descifrar: no quedó guardada." >&2
  exit 1
fi

echo "Clave generada y probada."
echo "Privada (no la pegues en ningún chat): $KEY"
echo "Pública, para BACKUP_AGE_RECIPIENT: $(cat "$PUB")"
