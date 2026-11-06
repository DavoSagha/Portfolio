#!/usr/bin/env bash
# Prueba real del destino externo desde tu PC, sin servidor, en un stack aislado:
#   carga datos → backup a B2 → borra todo → baja el backup de B2 → restaura → compara
# Al final borra de B2 solo el archivo que creó. Las credenciales y la clave privada salen de
# una carpeta fuera del repo y nunca se imprimen.
#
#   bash scripts/test-b2.sh
set -euo pipefail

DIR="${PORTFOLIO_SECRETS:-$HOME/.portfolio-secrets}"
RCLONE_FILE="$DIR/rclone.conf"
B2_ENV="$DIR/b2.env"
KEY="$DIR/age.key"
PUB="$DIR/age.pub"

[ -f "$KEY" ] && [ -f "$PUB" ] || {
  echo "Falta la clave. Generala antes con: bash scripts/backup-key-generate.sh" >&2
  exit 2
}
if [ ! -f "$RCLONE_FILE" ] || [ ! -f "$B2_ENV" ]; then
  mkdir -p "$DIR"
  (
    umask 077
    [ -f "$RCLONE_FILE" ] || cat > "$RCLONE_FILE" <<'EOF'
[offsite]
type = b2
account =
key =
hard_delete = true
EOF
    [ -f "$B2_ENV" ] || cat > "$B2_ENV" <<'EOF'
# offsite:<nombre-del-bucket>
BACKUP_RCLONE_REMOTE=offsite:
EOF
  )
  echo "Creé $RCLONE_FILE y $B2_ENV. Completalos con tu editor y volvé a correr este script."
  exit 2
fi

# Sin los finales de línea de Windows, que quedarían pegados al valor.
BACKUP_RCLONE_REMOTE="$(tr -d '' < "$B2_ENV" | sed -n 's/^BACKUP_RCLONE_REMOTE=//p')"
case "${BACKUP_RCLONE_REMOTE:-}" in
  *:?* | /?*) ;;
  *)
    echo "Falta el nombre del bucket en $B2_ENV" >&2
    exit 2
    ;;
esac

PROJECT=portfolio-b2-test
PORT=8097
BASE="http://localhost:$PORT"
WORK="$(mktemp -d)"
if command -v cygpath > /dev/null; then
  WORK="$(cygpath -m "$WORK")"
  KEY="$(cygpath -m "$KEY")"
fi
ENV_FILE="$WORK/env"
tr -d '' < "$RCLONE_FILE" > "$WORK/rclone.conf"
OVERRIDE=()
[ -n "${TEST_COMPOSE_OVERRIDE:-}" ] && OVERRIDE=(-f "$TEST_COMPOSE_OVERRIDE")

compose() {
  MSYS_NO_PATHCONV=1 docker compose -p "$PROJECT" --env-file "$ENV_FILE" \
    -f compose.yaml -f compose.prod.yaml ${OVERRIDE[@]+"${OVERRIDE[@]}"} "$@"
}
fail() { printf '\nFALLÓ: %s\n' "$*" >&2; exit 1; }
step() { printf '\n=== %s\n' "$*"; }
sql() { compose exec -T db psql -U portfolio -d portfolio -tAc "$1"; }
wait_site() {
  for _ in $(seq 1 60); do
    curl -fsS "$BASE/api/v1/health" > /dev/null 2>&1 && return 0
    sleep 2
  done
  fail "el sitio no respondió"
}
fingerprint() {
  sql "SELECT (SELECT count(*) FROM \"Project\"), (SELECT count(*) FROM \"ContactMessage\"),
    (SELECT md5(string_agg(body, ',' ORDER BY body)) FROM \"ContactMessage\")"
}
NAME=""
cleanup() {
  if [ -n "$NAME" ]; then
    compose run --rm -T backup rclone deletefile "$BACKUP_RCLONE_REMOTE/$NAME" > /dev/null 2>&1 \
      && echo "Borré de B2 el archivo de la prueba." \
      || echo "AVISO: no pude borrar $NAME de B2. Borralo desde su panel."
  fi
  compose down -v --remove-orphans > /dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

cat > "$ENV_FILE" <<EOF
POSTGRES_USER=portfolio
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=portfolio
SITE_URL=https://portfolio.example.test
SITE_ADDRESS=:80
HTTP_PORT=$PORT
HTTPS_PORT=8498
COMPOSE_PROFILES=backups
BACKUP_AGE_RECIPIENT=$(cat "$PUB")
BACKUP_RCLONE_REMOTE=$BACKUP_RCLONE_REMOTE
RCLONE_CONF=$WORK/rclone.conf
EOF

step "Levantando un stack aislado con datos de prueba"
compose up -d --build --wait > /dev/null 2>&1 || fail "el stack no arrancó"
wait_site
compose exec -T api node dist/cli/seed.js > /dev/null
MESSAGE="Mensaje de la prueba de B2 $(openssl rand -hex 4)."
curl -fsS -o /dev/null -H 'content-type: application/json' \
  -d "{\"name\":\"Prueba\",\"email\":\"prueba@example.com\",\"message\":\"$MESSAGE\"}" \
  "$BASE/api/v1/public/contact"
compose exec -T api sh -c 'printf "archivo de prueba" > /data/uploads/prueba-b2.txt'
BEFORE="$(fingerprint)"

step "Backup real al destino externo"
compose exec -T backup backup
NAME="$(compose exec -T backup sh -c 'ls -1 /backups/portfolio-*.tar.age | sort -r | head -1 | xargs basename' | tr -d '\r')"
compose exec -T backup rclone lsf "$BACKUP_RCLONE_REMOTE" | tr -d '\r' | grep -qx "$NAME" || fail "el backup no aparece en el destino externo"
LOCAL_HASH="$(compose exec -T backup sha256sum "/backups/$NAME" | cut -d' ' -f1)"
echo "OK: $NAME está en el destino externo."

step "Desastre: se borran los datos y los backups locales de este stack"
compose down -v --remove-orphans > /dev/null 2>&1
compose up -d --wait > /dev/null 2>&1 || fail "el stack limpio no arrancó"
[ "$(sql 'SELECT count(*) FROM "Project"')" = "0" ] || fail "el stack no quedó limpio"

step "Restauración desde el destino externo"
compose stop api web > /dev/null 2>&1
compose run --rm -T backup rclone copyto "$BACKUP_RCLONE_REMOTE/$NAME" "/backups/$NAME"
[ "$(compose run --rm -T backup sha256sum "/backups/$NAME" | cut -d' ' -f1)" = "$LOCAL_HASH" ] || fail "el archivo bajado es distinto del subido"
echo SI | compose run --rm -T -v "$KEY:/run/age.key:ro" backup restore "/backups/$NAME"
compose start api web > /dev/null 2>&1
wait_site

step "Comparación"
[ "$(fingerprint)" = "$BEFORE" ] || fail "los datos difieren"
[ "$(compose exec -T api cat /data/uploads/prueba-b2.txt)" = "archivo de prueba" ] || fail "el archivo no volvió"
curl -fsS -o /dev/null "$BASE/" || fail "el sitio no responde"

printf '\nOK: subida, descarga y restauración completas desde el destino externo.\n'
