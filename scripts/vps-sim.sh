#!/usr/bin/env bash
# Simula un VPS chico: un Docker aislado, dentro de un contenedor con RAM, swap y CPU limitadas.
# Construye desde cero, levanta producción, le mete carga, reconstruye con el sitio andando y
# mide memoria y disco. Trabaja sobre el último commit y nunca toca los otros stacks.
#
#   scripts/vps-sim.sh [RAM en MiB] [swap en MiB] [carpeta de resultados]
#
# El contenedor no incluye el sistema operativo del servidor. Para contemplarlo, pasá menos RAM.
set -uo pipefail

RAM_MB="${1:-2048}"
SWAP_MB="${2:-2048}"
OUT="${3:-vps-sim-results}"
NAME="portfolio-vps-sim"
PORT=18443
mkdir -p "$OUT"
REPORT="$OUT/report-${RAM_MB}m-${SWAP_MB}s.txt"
: > "$REPORT"

vm() { MSYS_NO_PATHCONV=1 docker exec "$NAME" sh -c "$1"; }
dc() { vm "cd /src && docker compose -f compose.yaml -f compose.prod.yaml $1"; }
say() { printf '%s\n' "$*" | tee -a "$REPORT"; }
cleanup() {
  docker rm -fv "$NAME" > /dev/null 2>&1
  docker volume rm "$NAME-docker" > /dev/null 2>&1
}
trap cleanup EXIT
cleanup

# Memoria del contenedor cada 2 s: anónima (no se puede descartar) y swap, en MiB.
sample_start() {
  vm "rm -f /tmp/mem.csv; while :; do
    a=\$(awk '/^anon /{print int(\$2/1048576)}' /sys/fs/cgroup/memory.stat)
    s=\$(( \$(cat /sys/fs/cgroup/memory.swap.current) / 1048576 ))
    echo \"\$a \$s\" >> /tmp/mem.csv; sleep 2; done" &
  SAMPLER=$!
}
sample_stop() {
  vm "pkill -f 'mem.csv' || true" > /dev/null 2>&1
  kill "$SAMPLER" 2> /dev/null
  wait "$SAMPLER" 2> /dev/null
  vm "awk '{ if (\$1>a) a=\$1; if (\$2>s) s=\$2; if (\$1+\$2>t) t=\$1+\$2 } END { printf \"pico: %d MiB de RAM anónima, %d MiB de swap, %d MiB en total\n\", a, s, t }' /tmp/mem.csv" | tee -a "$REPORT"
}
ooms() { vm "awk '/oom_kill/{print \$2}' /sys/fs/cgroup/memory.events"; }

say "# Simulación: ${RAM_MB} MiB de RAM, ${SWAP_MB} MiB de swap, 2 vCPU"
docker run -d --name "$NAME" --privileged --cgroupns=private \
  --memory "${RAM_MB}m" --memory-swap "$((RAM_MB + SWAP_MB))m" --cpus 2 \
  -p "$PORT:443" -v "$NAME-docker:/var/lib/docker" -e DOCKER_TLS_CERTDIR= \
  docker:29-dind > /dev/null || exit 1
for _ in $(seq 1 60); do vm 'docker info' > /dev/null 2>&1 && break; sleep 1; done

vm 'mkdir -p /src'
git archive HEAD | MSYS_NO_PATHCONV=1 docker exec -i "$NAME" tar -x -C /src

# compose exige estas variables también para construir. La clave real se genera con la imagen.
vm "cat > /src/.env <<EOF
APP_ENV=production
POSTGRES_USER=portfolio
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=portfolio
SITE_URL=https://localhost:$PORT
SITE_ADDRESS=localhost
HTTP_PORT=80
HTTPS_PORT=443
COMPOSE_PROFILES=backups
BACKUP_AGE_RECIPIENT=pendiente
EOF"

say ''
say '## Construcción desde cero'
sample_start
START=$SECONDS
dc 'build' > "$OUT/build-${RAM_MB}m-${SWAP_MB}s.log" 2>&1
BUILD_EXIT=$?
say "código de salida: $BUILD_EXIT, duración: $((SECONDS - START)) s"
sample_stop
say "procesos matados por falta de memoria: $(ooms)"
if [ "$BUILD_EXIT" -ne 0 ]; then
  tail -30 "$OUT/build-${RAM_MB}m-${SWAP_MB}s.log" >> "$REPORT"
  say 'RESULTADO: la construcción falló.'
  exit 2
fi
vm 'docker system df' | tee -a "$REPORT"

RECIPIENT="$(vm 'docker run --rm --entrypoint age-keygen src-backup 2> /dev/null' | grep -o 'age1[a-z0-9]*' | head -1)"
[ -n "$RECIPIENT" ] || { say 'RESULTADO: no pude generar la clave de prueba.'; exit 2; }
vm "sed -i 's/^BACKUP_AGE_RECIPIENT=.*/BACKUP_AGE_RECIPIENT=$RECIPIENT/' /src/.env"

say ''
say '## Arranque de producción'
START=$SECONDS
dc 'up -d --wait' > "$OUT/up-${RAM_MB}m-${SWAP_MB}s.log" 2>&1 || { tail -30 "$OUT/up-${RAM_MB}m-${SWAP_MB}s.log" | tee -a "$REPORT"; say 'RESULTADO: no arrancó.'; exit 3; }
say "listo en $((SECONDS - START)) s"
dc 'exec -T api node dist/cli/seed.js' | tee -a "$REPORT"
curl -kfsS -o /dev/null "https://localhost:$PORT/" || say 'AVISO: el inicio no respondió'
sleep 30
say ''
say '## En reposo'
vm "docker stats --no-stream --format '{{.Name}} {{.MemUsage}}'" | sed -E 's/^src-//' | tee -a "$REPORT"
vm "awk '/^anon /{printf \"RAM anónima total: %d MiB\n\", \$2/1048576}' /sys/fs/cgroup/memory.stat" | tee -a "$REPORT"
vm 'echo "swap en uso: $(( $(cat /sys/fs/cgroup/memory.swap.current) / 1048576 )) MiB"' | tee -a "$REPORT"

say ''
say '## Carga: 2000 pedidos, 16 a la vez, páginas públicas'
sample_start
for path in / /proyectos /proyectos/appfut /api/v1/public/home; do
  for _ in $(seq 1 500); do printf '%s\n' "$path"; done
done > "$OUT/paths.txt"
START=$SECONDS
xargs -P 16 -I{} curl -ks -o /dev/null -w '%{http_code} %{time_total}\n' "https://localhost:$PORT{}" < "$OUT/paths.txt" > "$OUT/load.txt"
say "duración: $((SECONDS - START)) s; respuestas por código: $(cut -d' ' -f1 "$OUT/load.txt" | sort | uniq -c | tr -s ' ' | tr '\n' ';')"
say "tiempo p50: $(cut -d' ' -f2 "$OUT/load.txt" | sort -n | sed -n '1000p') s, p95: $(cut -d' ' -f2 "$OUT/load.txt" | sort -n | sed -n '1900p') s"
sample_stop

say ''
say '## Actualización: reconstruir sin caché con el sitio andando'
sample_start
: > "$OUT/during.txt"
( while :; do curl -ks -m 10 -o /dev/null -w '%{http_code} %{time_total}\n' "https://localhost:$PORT/" >> "$OUT/during.txt"; sleep 2; done ) &
PROBE=$!
START=$SECONDS
dc 'build --no-cache' > "$OUT/rebuild-${RAM_MB}m-${SWAP_MB}s.log" 2>&1
REBUILD_EXIT=$?
kill "$PROBE" 2> /dev/null
say "código de salida: $REBUILD_EXIT, duración: $((SECONDS - START)) s"
say "sitio durante la construcción: $(wc -l < "$OUT/during.txt") pedidos; no 200: $(grep -cv '^200 ' "$OUT/during.txt"); más lento: $(cut -d' ' -f2 "$OUT/during.txt" | sort -n | tail -1) s"
sample_stop
say "procesos matados por falta de memoria: $(ooms)"
START=$SECONDS
dc 'up -d --wait' > /dev/null 2>&1 && say "servicios recreados en $((SECONDS - START)) s" || say 'AVISO: no se pudieron recrear'

say ''
say '## Disco: lo que ocupa cada parte'
vm 'docker system df' | tee -a "$REPORT"
vm 'docker builder prune -af > /dev/null; docker image prune -f > /dev/null; echo "--- después de limpiar la caché y las imágenes viejas"; docker system df' | tee -a "$REPORT"
vm "docker images --format '{{.Repository}}:{{.Tag}} {{.Size}}'" | tee -a "$REPORT"

# Peor caso razonable para el contenido: 10 MiB de imágenes que no comprimen y un año de eventos.
dc 'exec -T api sh -c "head -c 10485760 /dev/urandom > /data/uploads/peso-de-prueba.bin"'
dc "exec -T db psql -q -U portfolio -d portfolio -c \"INSERT INTO \\\"Event\\\" (type, path, ref, \\\"visitorHash\\\", \\\"createdAt\\\") SELECT 'PAGE_VIEW', '/proyectos/carta-digital-catedral-del-pisco', 'linkedin', md5(g::text), now() - (g % 365) * interval '1 day' FROM generate_series(1, 365000) g\""
say "base de datos con 365.000 eventos: $(dc 'exec -T db psql -U portfolio -d portfolio -tAc "SELECT pg_size_pretty(pg_database_size(current_database()))"')"
dc 'exec -T backup backup' | tail -1 | tee -a "$REPORT"
say "un backup: $(dc 'exec -T backup sh -c "du -h /backups/*.age | tail -1"')"
say "archivos: $(dc 'exec -T api du -sh /data/uploads')"
say "logs de contenedores: $(vm 'du -ch /var/lib/docker/containers/*/*-json.log 2> /dev/null | tail -1')"
say "total en /var/lib/docker: $(vm 'du -sh /var/lib/docker | cut -f1')"
vm 'du -sh /var/lib/docker/volumes/* 2> /dev/null | sed "s#/var/lib/docker/volumes/##"' | tee -a "$REPORT"
say "procesos matados por falta de memoria, total: $(ooms)"
say ''
say 'RESULTADO: la simulación terminó.'
