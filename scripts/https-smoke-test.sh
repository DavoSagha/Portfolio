#!/usr/bin/env bash
# Prueba local de HTTPS con la configuración de producción. Caddy usa su CA interna para
# `localhost`: verifica TLS, redirección y cabeceras, pero no la emisión real de Let's Encrypt,
# que necesita un dominio público (ver docs/deploy.md).
set -euo pipefail

PROJECT=portfolio-https-test
WORK="$(mktemp -d)"
command -v cygpath > /dev/null && WORK="$(cygpath -m "$WORK")"
ENV_FILE="$WORK/env"
HTTP=8092
HTTPS=8493
BASE="https://localhost:$HTTPS"

compose() {
  MSYS_NO_PATHCONV=1 docker compose -p "$PROJECT" --env-file "$ENV_FILE" \
    -f compose.yaml -f compose.prod.yaml "$@"
}
fail() { printf '\nFALLÓ: %s\n' "$*" >&2; exit 1; }
cleanup() {
  compose down -v --remove-orphans > /dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

cat > "$ENV_FILE" <<EOF
POSTGRES_USER=portfolio
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=portfolio
SITE_URL=https://localhost:$HTTPS
SITE_ADDRESS=localhost
HTTP_PORT=$HTTP
HTTPS_PORT=$HTTPS
EOF

compose up -d --build --wait > /dev/null 2>&1

ready=""
for _ in $(seq 1 60); do
  if curl -kfsS -o /dev/null "$BASE/api/v1/health" 2> /dev/null; then ready=1; break; fi
  sleep 2
done
[ -n "$ready" ] || { compose logs --tail 40 caddy >&2; fail "HTTPS no respondió"; }
echo "OK: responde por HTTPS"

# Sin -k tiene que fallar: el certificado es de la CA interna, y curl la valida de verdad.
if curl -fsS -o /dev/null "$BASE/api/v1/health" 2> /dev/null; then fail "aceptó un certificado no confiable"; fi

code="$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "http://localhost:$HTTP/proyectos")"
case "$code" in
  30[18]\ https://*) echo "OK: HTTP redirige a HTTPS ($code)" ;;
  *) fail "HTTP no redirige a HTTPS: $code" ;;
esac

headers="$(curl -ksSI "$BASE/")"
grep -qi '^strict-transport-security: max-age=31536000' <<< "$headers" || fail "falta HSTS"
grep -qi '^content-security-policy:.*nonce-' <<< "$headers" || fail "falta la CSP"
if grep -qi '^server:' <<< "$headers"; then fail "expone la cabecera Server"; fi
echo "OK: HSTS y CSP presentes, sin cabecera Server"

alpn="$(curl -ksS -o /dev/null -w '%{http_version}' "$BASE/")"
echo "OK: versión de HTTP negociada: $alpn"

# Ningún puerto interno publicado: solo Caddy.
published="$(compose ps --format '{{.Service}} {{.Publishers}}' | grep -v '^caddy' | grep -E '0\.0\.0\.0|127\.0\.0\.1' || true)"
[ -z "$published" ] || fail "hay servicios internos con puertos publicados: $published"
echo "OK: solo Caddy publica puertos"

# La configuración por defecto, sin variables de backup: el sitio anda y el servicio no existe.
if compose ps -a --format '{{.Service}}' | grep -qx backup; then fail "el servicio de backups arrancó sin activarlo"; fi
echo "OK: los backups externos quedan apagados por defecto"

printf '\nOK: prueba de HTTPS completa.\n'
