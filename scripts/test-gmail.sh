#!/usr/bin/env bash
# Prueba real del email de contacto desde tu PC, con el código de producción y sin servidor:
# levanta un stack aislado, manda un mensaje por el formulario y lee el resultado en la base.
# Las credenciales salen de un archivo fuera del repo y nunca se imprimen.
#
#   bash scripts/test-gmail.sh
set -euo pipefail

DIR="${PORTFOLIO_SECRETS:-$HOME/.portfolio-secrets}"
SECRETS="$DIR/gmail.env"

if [ ! -f "$SECRETS" ]; then
  mkdir -p "$DIR"
  (
    umask 077
    cat > "$SECRETS" <<'EOF'
# Contraseña de aplicación de Google, sin espacios. Nunca la de la cuenta.
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
CONTACT_TO=
EOF
  )
  echo "Creé $SECRETS. Completalo con tu editor y volvé a correr este script."
  exit 2
fi

PROJECT=portfolio-gmail-test
PORT=8096
BASE="http://localhost:$PORT"
WORK="$(mktemp -d)"
command -v cygpath > /dev/null && WORK="$(cygpath -m "$WORK")"
ENV_FILE="$WORK/env"
MARK="prueba-$(openssl rand -hex 4)"

compose() { docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f compose.yaml "$@"; }
cleanup() {
  compose down -v --remove-orphans > /dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

cat "$SECRETS" > "$ENV_FILE"
cat >> "$ENV_FILE" <<EOF

APP_ENV=${TEST_APP_ENV:-production}
POSTGRES_USER=portfolio
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=portfolio
SITE_URL=https://portfolio.example.test
SITE_ADDRESS=:80
HTTP_PORT=$PORT
HTTPS_PORT=8497
EOF

echo "Levantando un stack aislado…"
compose up -d --build --wait > /dev/null 2>&1 || {
  compose logs --tail 20 api | sed -E 's/(PASS[^ ]*[=:] *)[^ ]+/\1***/I' >&2
  echo "FALLÓ: el stack no arrancó. ¿Falta alguna variable en $SECRETS?" >&2
  exit 1
}

code="$(curl -s -o /dev/null -w '%{http_code}' -H 'content-type: application/json' \
  -d "{\"name\":\"Prueba del portfolio\",\"email\":\"prueba@example.com\",\"message\":\"Mensaje de prueba $MARK.\"}" \
  "$BASE/api/v1/public/contact")"
[ "$code" = "202" ] || { echo "FALLÓ: el formulario respondió $code" >&2; exit 1; }

query="SELECT coalesce(to_char(\"emailSentAt\",'\"sent\"'),'') || '|' || coalesce(\"emailError\",'') FROM \"ContactMessage\" WHERE body LIKE '%$MARK%'"
result="|"
for _ in $(seq 1 30); do
  result="$(compose exec -T db psql -U portfolio -d portfolio -tAc "$query" | tr -d '\r')"
  [ "$result" != "|" ] && break
  sleep 1
done

case "$result" in
  sent*)
    echo "OK: el servidor SMTP aceptó el mensaje."
    echo "Falta tu comprobación: buscá en la casilla de CONTACT_TO el asunto \"Mensaje del portfolio: Prueba del portfolio\", con el código $MARK, y mirá también en spam."
    ;;
  "|")
    echo "FALLÓ: sin resultado después de 30 s." >&2
    exit 1
    ;;
  *)
    echo "FALLÓ: ${result#|}" >&2
    exit 1
    ;;
esac
