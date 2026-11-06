#!/usr/bin/env bash
# Apunta un subdominio de DuckDNS a una IP. Pide el token sin mostrarlo y sin dejarlo en el
# historial ni en la lista de procesos.
#
#   bash scripts/duckdns-update.sh <subdominio> <ip>
set -euo pipefail

[ "$#" -eq 2 ] || { echo "Uso: $0 <subdominio, sin .duckdns.org> <ip>" >&2; exit 2; }
SUB="$1"
IP="$2"
[[ "$SUB" =~ ^[a-z0-9-]+$ ]] || { echo "Subdominio inválido: $SUB" >&2; exit 2; }
[[ "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "IP inválida: $IP" >&2; exit 2; }

read -rsp 'Token de DuckDNS (no se muestra): ' TOKEN
echo
[ -n "$TOKEN" ] || { echo "Token vacío." >&2; exit 2; }

# El token va por la entrada estándar: curl lo lee como configuración, no como argumento.
ANSWER="$(printf 'url = "https://www.duckdns.org/update?domains=%s&token=%s&ip=%s"\n' "$SUB" "$TOKEN" "$IP" | curl -fsS -m 20 --config -)"
unset TOKEN

if [ "$ANSWER" = "OK" ]; then
  echo "OK: $SUB.duckdns.org apunta a $IP. Puede tardar unos minutos en verse."
else
  echo "DuckDNS rechazó el pedido. Revisá el subdominio y el token." >&2
  exit 1
fi
