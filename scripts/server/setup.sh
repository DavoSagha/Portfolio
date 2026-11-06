#!/usr/bin/env bash
# Prepara un Ubuntu LTS recién creado. Se corre una vez, como root, por SSH.
# Se puede repetir: cada paso comprueba si ya está hecho.
#
#   bash scripts/server/setup.sh
set -euo pipefail

[ "$(id -u)" = 0 ] || { echo "Correlo como root." >&2; exit 1; }
# shellcheck disable=SC1091
. /etc/os-release
[ "${ID:-}" = ubuntu ] || { echo "Este script es para Ubuntu; encontré: ${ID:-desconocido}." >&2; exit 1; }

# El puerto real de esta conexión: si el proveedor no usa el 22, el firewall no te deja afuera.
SSH_PORT="${SSH_CONNECTION:+$(echo "$SSH_CONNECTION" | awk '{print $4}')}"
[ -n "$SSH_PORT" ] || { echo "No detecté la conexión SSH. Correlo por SSH." >&2; exit 1; }

echo "== Memoria virtual de 2 GB"
if ! swapon --show=NAME --noheadings | grep -q .; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile > /dev/null
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
echo 'vm.swappiness=10' > /etc/sysctl.d/90-portfolio.conf
sysctl -q --system

echo "== Actualizaciones de seguridad automáticas"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq unattended-upgrades ufw git curl openssl > /dev/null
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "== Límite de los logs del sistema"
mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=200M\n' > /etc/systemd/journald.conf.d/90-portfolio.conf
systemctl restart systemd-journald

echo "== Docker"
if ! command -v docker > /dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker > /dev/null

echo "== Firewall: SSH en el puerto $SSH_PORT y web"
ufw allow "$SSH_PORT/tcp" > /dev/null
ufw allow 80/tcp > /dev/null
ufw allow 443/tcp > /dev/null
ufw allow 443/udp > /dev/null
ufw --force enable > /dev/null

echo "== SSH solo con clave"
if [ -s /root/.ssh/authorized_keys ]; then
  # 00- gana a los archivos que agrega el proveedor, porque sshd se queda con el primer valor.
  printf 'PasswordAuthentication no\nPermitRootLogin prohibit-password\n' > /etc/ssh/sshd_config.d/00-portfolio.conf
  sshd -t
  systemctl reload ssh
  echo "Listo. NO cierres esta sesión: abrí otra y comprobá que entrás con tu clave."
else
  echo "AVISO: no hay claves en /root/.ssh/authorized_keys y dejé la contraseña activa para no dejarte afuera."
fi

echo
echo "Servidor preparado. Seguí con: bash scripts/server/preflight.sh <tu-subdominio>.duckdns.org"
