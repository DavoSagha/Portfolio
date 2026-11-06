#!/usr/bin/env bash
# Prepara un Ubuntu LTS recién creado. Se corre una vez, como root, por SSH.
# Se puede repetir: cada paso comprueba si ya está hecho.
#
#   bash setup.sh <usuario>
#
# Crea el usuario sin contraseña, con tu clave SSH. No cambia el acceso por SSH: el de root con
# contraseña se cierra aparte, con ssh-cerrar.sh, después de comprobar que entrás con la clave.
set -euo pipefail

[ "$(id -u)" = 0 ] || { echo "Correlo como root." >&2; exit 1; }
[ "$#" -eq 1 ] || { echo "Uso: $0 <usuario>" >&2; exit 2; }
NEW_USER="$1"
[[ "$NEW_USER" =~ ^[a-z][a-z0-9-]{0,30}$ ]] && [ "$NEW_USER" != root ] \
  || { echo "Usuario inválido: $NEW_USER" >&2; exit 2; }
# shellcheck disable=SC1091
. /etc/os-release
[ "${ID:-}" = ubuntu ] || { echo "Este script es para Ubuntu; encontré: ${ID:-desconocido}." >&2; exit 1; }
[ -s /root/.ssh/authorized_keys ] \
  || { echo "No hay claves en /root/.ssh/authorized_keys: el usuario nuevo no podría entrar." >&2; exit 1; }

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
# Una instalación mínima puede no traer sudo ni ss.
apt-get install -y -qq unattended-upgrades ufw git curl openssl sudo iproute2 ca-certificates nano > /dev/null
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
# Sin esto, en algunas imágenes el firewall se apaga en el primer reinicio.
systemctl enable --now ufw > /dev/null 2>&1

echo "== Usuario $NEW_USER, con tu clave SSH"
id "$NEW_USER" > /dev/null 2>&1 || adduser --disabled-password --gecos '' "$NEW_USER" > /dev/null
usermod -aG sudo,docker "$NEW_USER"
home_dir="$(getent passwd "$NEW_USER" | cut -d: -f6)"
install -d -m 700 -o "$NEW_USER" -g "$NEW_USER" "$home_dir/.ssh"
install -m 600 -o "$NEW_USER" -g "$NEW_USER" /root/.ssh/authorized_keys "$home_dir/.ssh/authorized_keys"
# No tiene contraseña que pedirle. El grupo docker ya equivale a root: esto no agrega poder.
sudoers="/etc/sudoers.d/90-portfolio"
printf '%s ALL=(ALL) NOPASSWD:ALL\n' "$NEW_USER" > "$sudoers.tmp"
chmod 440 "$sudoers.tmp"
visudo -cqf "$sudoers.tmp"
mv "$sudoers.tmp" "$sudoers"
install -d -o "$NEW_USER" -g "$NEW_USER" /opt/portfolio

echo
echo "Servidor preparado. El acceso por SSH no cambió."
echo "NO cierres esta sesión: abrí otra terminal y comprobá que entrás con:"
echo "  ssh -p $SSH_PORT $NEW_USER@<ip>"
