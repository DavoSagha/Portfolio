#!/usr/bin/env bash
# Comprobaciones en el servidor antes de levantar el sitio. Solo lee: no cambia nada.
#
#   bash scripts/server/preflight.sh <dominio>
set -uo pipefail

DOMAIN="${1:-}"
[ -n "$DOMAIN" ] || { echo "Uso: $0 <dominio>" >&2; exit 2; }

problems=0
ok() { echo "OK    $*"; }
bad() { echo "MAL   $*"; problems=$((problems + 1)); }
info() { echo "INFO  $*"; }
reach() { timeout 8 bash -c "exec 3<>/dev/tcp/$1/$2" 2> /dev/null; }

# shellcheck disable=SC1091
. /etc/os-release
case "${ID:-}-${VERSION_ID:-}" in
  ubuntu-24.04 | ubuntu-26.04) ok "Sistema: $PRETTY_NAME" ;;
  *) bad "Sistema no previsto: ${PRETTY_NAME:-desconocido}" ;;
esac

ram="$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)"
swap="$(awk '/SwapTotal/{print int($2/1024)}' /proc/meminfo)"
info "RAM: $ram MiB; swap: $swap MiB"
[ "$swap" -ge 1900 ] && ok "Swap suficiente" || bad "Falta swap: corré scripts/server/setup.sh"

free_gb="$(df -BG --output=avail / | tail -1 | tr -dc '0-9')"
total_gb="$(df -BG --output=size / | tail -1 | tr -dc '0-9')"
info "Disco: $free_gb GB libres de $total_gb GB"
[ "$free_gb" -ge 8 ] && ok "Espacio libre suficiente" || bad "Quedan menos de 8 GB libres"

command -v docker > /dev/null && docker compose version > /dev/null 2>&1 \
  && ok "Docker: $(docker --version)" || bad "Falta Docker: corré scripts/server/setup.sh"

ip="$(curl -4 -fsS -m 10 https://api.ipify.org 2> /dev/null || true)"
[ -n "$ip" ] && info "IP pública de salida: $ip" || bad "No pude averiguar la IP pública"
resolved="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}')"
if [ -z "$resolved" ]; then
  bad "$DOMAIN todavía no resuelve"
elif [ "$resolved" = "$ip" ]; then
  ok "$DOMAIN apunta a este servidor"
else
  bad "$DOMAIN apunta a $resolved, no a $ip"
fi

for port in 80 443; do
  if ss -ltnH "sport = :$port" | grep -q .; then
    info "Algo ya escucha en el puerto $port: $(ss -ltnpH "sport = :$port" | awk '{print $NF}' | head -1)"
  else
    ok "Puerto $port libre en este servidor"
  fi
done

reach smtp.gmail.com 587 && ok "Salida al puerto 587 de Gmail" \
  || bad "No hay salida al puerto 587 de Gmail: el proveedor puede estar bloqueándolo"
reach api.backblazeb2.com 443 && ok "Salida a Backblaze B2" \
  || info "Sin salida a Backblaze B2: solo importa si activás los backups externos"
reach acme-v02.api.letsencrypt.org 443 && ok "Salida a Let's Encrypt" || bad "No hay salida a Let's Encrypt"

echo
info "Esto no comprueba la entrada desde internet a los puertos 80 y 443. Para eso, desde tu PC:"
info "  curl -I http://$DOMAIN    (cuando el sitio esté levantado)"
if [ "$problems" -gt 0 ]; then
  echo "Hay $problems problema(s) para resolver."
  exit 1
fi
echo "Todo en orden."
