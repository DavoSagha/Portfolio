#!/usr/bin/env bash
# Prueba de punta a punta del backup y la restauración, con la configuración de producción y
# en un stack aislado (portfolio-restore-test): nunca toca el de desarrollo ni el de e2e.
#
#   carga datos → backup → borra TODO (volúmenes incluidos) → stack limpio → restaura → compara
#
# Las credenciales y la clave se generan al azar en cada corrida y se descartan al final.
set -euo pipefail

PROJECT=portfolio-restore-test
PORT=8090
BASE="http://localhost:$PORT"
WORK="$(mktemp -d)"
# docker en Windows necesita rutas de Windows; en Linux, cygpath no existe y no hace falta.
command -v cygpath > /dev/null && WORK="$(cygpath -m "$WORK")"
ENV_FILE="$WORK/env"
ADMIN_USER=restore-admin
ADMIN_PASS="$(openssl rand -hex 16)"

compose() {
  # Sin esto, Git Bash en Windows reescribe rutas como /backups antes de pasárselas a docker.
  MSYS_NO_PATHCONV=1 docker compose -p "$PROJECT" --env-file "$ENV_FILE" \
    -f compose.yaml -f compose.prod.yaml -f "$WORK/test-overrides.yaml" "$@"
}
step() { printf '\n=== %s\n' "$*"; }
fail() { printf '\nFALLÓ: %s\n' "$*" >&2; exit 1; }
sql() { compose exec -T db psql -U portfolio -d portfolio -tAc "$1"; }
wait_site() {
  for _ in $(seq 1 60); do
    curl -fsS "$BASE/api/v1/health" > /dev/null 2>&1 && return 0
    sleep 2
  done
  compose logs --tail 40 >&2
  fail "el sitio no respondió"
}
fingerprint() {
  # Filas de todas las tablas de contenido: si difieren, la restauración perdió datos.
  sql "SELECT
    (SELECT count(*) FROM \"Project\"), (SELECT count(*) FROM \"Skill\"),
    (SELECT count(*) FROM \"TimelineEntry\"), (SELECT count(*) FROM \"ContactMessage\"),
    (SELECT count(*) FROM \"CvVersion\"), (SELECT count(*) FROM \"StoredFile\"),
    (SELECT count(*) FROM \"AdminUser\"),
    (SELECT md5(string_agg(sha256, ',' ORDER BY sha256)) FROM \"StoredFile\"),
    (SELECT md5(string_agg(body, ',' ORDER BY body)) FROM \"ContactMessage\")"
}
cleanup() {
  compose down -v --remove-orphans > /dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

step "Preparando un stack de producción aislado"
docker build -q -f docker/backup/Dockerfile -t portfolio-backup-tools . > /dev/null
docker run --rm --entrypoint age-keygen portfolio-backup-tools > "$WORK/age.key" 2> /dev/null
RECIPIENT="$(grep -o 'age1[a-z0-9]*' "$WORK/age.key" | head -1)"
docker run --rm --entrypoint age-keygen portfolio-backup-tools > "$WORK/other.key" 2> /dev/null

cat > "$ENV_FILE" <<EOF
POSTGRES_USER=portfolio
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=portfolio
SITE_URL=https://portfolio.example.test
SITE_ADDRESS=:80
HTTP_PORT=$PORT
HTTPS_PORT=8453
BACKUP_AGE_RECIPIENT=$RECIPIENT
BACKUP_RCLONE_REMOTE=/offsite
BACKUP_CRON=* * * * *
EOF
# Lo único distinto de producción: el destino externo es una carpeta, no un servicio.
cat > "$WORK/test-overrides.yaml" <<EOF
services:
  backup:
    volumes:
      - offsite:/offsite
volumes:
  offsite:
EOF

compose up -d --build --wait
wait_site

step "La API de producción rechaza credenciales de ejemplo"
if docker run --rm -e APP_ENV=production \
  -e DATABASE_URL=postgresql://portfolio:portfolio@db:5432/portfolio \
  -e SITE_URL=https://portfolio.example.test \
  --entrypoint node "$PROJECT-api" dist/server.js > "$WORK/badenv.log" 2>&1; then
  fail "arrancó con la contraseña de ejemplo"
fi
grep -q 'DATABASE_URL' "$WORK/badenv.log" || fail "el error no nombra la variable"
if grep -q 'portfolio:portfolio' "$WORK/badenv.log"; then fail "el error muestra el secreto"; fi

step "En producción el seed no corre solo"
[ "$(sql 'SELECT count(*) FROM "Project"')" = "0" ] || fail "el seed corrió solo"
compose exec -T api node dist/cli/seed.js

step "Cargando datos: administrador, CV, foto y un mensaje"
HASH="$(compose exec -T api node -e "import('argon2').then(async ({default:a})=>{process.stdout.write(await a.hash(process.argv[1],{type:a.argon2id,memoryCost:19456,timeCost:2,parallelism:1}))})" "$ADMIN_PASS")"
sql "INSERT INTO \"AdminUser\" (id, username, \"passwordHash\", \"updatedAt\")
     VALUES ('restoreadmin00000000000000', '$ADMIN_USER', '$HASH', now())" > /dev/null

login() {
  curl -fsS -c "$WORK/cookies" -H 'content-type: application/json' \
    -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$1\"}" "$BASE/api/v1/auth/login"
}
CSRF="$(login "$ADMIN_PASS" | sed -E 's/.*"csrfToken":"([^"]+)".*/\1/')"
# El navegador solo enviaría la cookie Secure por HTTPS; curl la lee del archivo y se pasa a mano.
SID="$(awk '$6=="sid"{print $7}' "$WORK/cookies")"
[ -n "$SID" ] || fail "no hubo cookie de sesión"

printf '%%PDF-1.4\n%% CV de la prueba de restauración %s\n%%%%EOF\n' "$(openssl rand -hex 8)" > "$WORK/cv.pdf"
curl -fsS -o /dev/null -H "Cookie: sid=$SID" -H "X-CSRF-Token: $CSRF" \
  -F profile=backend -F label=Prueba -F "file=@$WORK/cv.pdf;type=application/pdf" \
  "$BASE/api/v1/admin/cv"
printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' | openssl base64 -d -A > "$WORK/foto.png"
curl -fsS -o /dev/null -H "Cookie: sid=$SID" -H "X-CSRF-Token: $CSRF" \
  -F "file=@$WORK/foto.png;type=image/png" "$BASE/api/v1/admin/profile/photo"
curl -fsS -o /dev/null -H 'content-type: application/json' \
  -d '{"name":"Ana","email":"ana@ejemplo.com","message":"Mensaje que tiene que sobrevivir."}' \
  "$BASE/api/v1/public/contact"

BEFORE="$(fingerprint)"
CV_BEFORE="$(curl -fsS "$BASE/cv/backend" | sha256sum | cut -d' ' -f1)"
PHOTO_URL="$(curl -fsS "$BASE/api/v1/public/home" | sed -E 's/.*"photoUrl":"([^"]+)".*/\1/')"
PHOTO_BEFORE="$(curl -fsS "$BASE$PHOTO_URL" | sha256sum | cut -d' ' -f1)"
[ "$CV_BEFORE" = "$(sha256sum < "$WORK/cv.pdf" | cut -d' ' -f1)" ] || fail "el CV subido no coincide"

step "Backup manual, con el comando de docs/deploy.md"
compose exec -T backup backup

step "Backup automático: lo dispara el cron, con estos datos ya cargados"
AFTER_LOAD="$(compose exec -T backup date -u +%Y%m%dT%H%M%SZ | tr -d '\r')"
FILE=""
for _ in $(seq 1 60); do
  NEWEST="$(compose exec -T backup sh -c 'ls -1 /backups/portfolio-*.tar.age 2> /dev/null | sort -r | head -1' | tr -d '\r')"
  STAMP="$(basename "${NEWEST:-none}" | sed -E 's/portfolio-(.*)\.tar\.age/\1/')"
  if [ -n "$NEWEST" ] && [[ "$STAMP" > "$AFTER_LOAD" ]]; then
    FILE="$NEWEST"
    break
  fi
  sleep 3
done
[ -n "$FILE" ] || fail "el cron no generó un backup en 3 minutos"
compose logs backup | grep -q 'Backups programados' || fail "el cron no quedó programado"
NAME="$(basename "$FILE")"
compose exec -T backup sh -c "test -f '/offsite/$NAME'" || fail "no llegó al destino externo"
compose exec -T backup backup-healthcheck || fail "el healthcheck no lo reconoce"

step "El backup está cifrado"
compose cp "backup:$FILE" "$WORK/$NAME" > /dev/null
head -c 22 "$WORK/$NAME" | grep -q 'age-encryption.org' || fail "no es un archivo de age"
if LC_ALL=C grep -qa -e 'PGDMP' -e 'Mensaje que tiene' "$WORK/$NAME"; then fail "hay datos en claro"; fi

step "Una clave incorrecta o un backup dañado no tocan nada"
compose cp "$WORK/other.key" backup:/run/other.key > /dev/null
compose cp "$WORK/age.key" backup:/run/age.key > /dev/null
if compose exec -T -e RESTORE_CONFIRM=SI -e BACKUP_AGE_KEY_FILE=/run/other.key backup restore "$FILE" > "$WORK/wrongkey.log" 2>&1; then
  fail "restauró con una clave incorrecta"
fi
# Tiene que fallar al descifrar, y no por un motivo ajeno como una ruta mal escrita.
grep -q 'Descifrando' "$WORK/wrongkey.log" || fail "falló antes de intentar descifrar"
if grep -q 'Restaurando' "$WORK/wrongkey.log"; then fail "llegó a restaurar con otra clave"; fi
compose exec -T backup sh -c "head -c 5000 '$FILE' > /backups/danado.tar.age"
if compose exec -T -e RESTORE_CONFIRM=SI backup restore /backups/danado.tar.age > "$WORK/damaged.log" 2>&1; then
  fail "restauró un backup dañado"
fi
grep -q 'Descifrando' "$WORK/damaged.log" || fail "falló antes de intentar descifrar"
if grep -q 'Restaurando' "$WORK/damaged.log"; then fail "llegó a restaurar un archivo dañado"; fi
compose exec -T backup rm -f /backups/danado.tar.age
[ "$(fingerprint)" = "$BEFORE" ] || fail "un intento fallido cambió los datos"

step "Desastre: se borran todos los volúmenes"
compose down -v --remove-orphans > /dev/null 2>&1
if curl -fsS -m 3 "$BASE/api/v1/health" > /dev/null 2>&1; then fail "el stack sigue vivo"; fi

step "Stack limpio"
compose up -d --wait
wait_site
[ "$(sql 'SELECT count(*) FROM "Project"')" = "0" ] || fail "el stack no quedó limpio"
if curl -fsS "$BASE/cv/backend" > /dev/null 2>&1; then fail "el CV sigue disponible"; fi

step "Restauración desde la copia externa, como si el servidor se hubiera perdido"
compose stop api web > /dev/null 2>&1
compose cp "$WORK/$NAME" backup:/backups/ > /dev/null
# Los mismos comandos que docs/deploy.md, con la pregunta de confirmación incluida.
if echo NO | compose run --rm -T -v "$WORK/age.key:/run/age.key:ro" backup restore "/backups/$NAME" > /dev/null 2>&1; then
  fail "restauró sin la confirmación"
fi
[ "$(sql 'SELECT count(*) FROM "Project"')" = "0" ] || fail "restauró aunque se respondió NO"
echo SI | compose run --rm -T -v "$WORK/age.key:/run/age.key:ro" backup restore "/backups/$NAME"
compose start api web > /dev/null 2>&1
wait_site

step "Comparación"
AFTER="$(fingerprint)"
[ "$AFTER" = "$BEFORE" ] || fail "los datos difieren: antes [$BEFORE] después [$AFTER]"
[ "$(curl -fsS "$BASE/cv/backend" | sha256sum | cut -d' ' -f1)" = "$CV_BEFORE" ] || fail "el CV difiere"
[ "$(curl -fsS "$BASE$PHOTO_URL" | sha256sum | cut -d' ' -f1)" = "$PHOTO_BEFORE" ] || fail "la foto difiere"
login "$ADMIN_PASS" > /dev/null || fail "el login no funciona después de restaurar"
curl -fsS -o /dev/null "$BASE/" || fail "el sitio no responde"
[ "$(sql 'SELECT count(*) FROM "ContactMessage" WHERE body LIKE '"'"'Mensaje que%'"'"'')" = "1" ] || fail "se perdió el mensaje"

step "Una subida nueva funciona: los permisos de los archivos quedaron bien"
SID2="$(awk '$6=="sid"{print $7}' "$WORK/cookies")"
CSRF2="$(curl -fsS -H "Cookie: sid=$SID2" "$BASE/api/v1/auth/me" | sed -E 's/.*"csrfToken":"([^"]+)".*/\1/')"
curl -fsS -o /dev/null -H "Cookie: sid=$SID2" -H "X-CSRF-Token: $CSRF2" \
  -F profile=soporte -F label=Nueva -F "file=@$WORK/cv.pdf;type=application/pdf" \
  "$BASE/api/v1/admin/cv" || fail "no se pudo subir un archivo después de restaurar"

printf '\nOK: backup, restauración y comparación completos.\n'
