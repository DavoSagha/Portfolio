#!/usr/bin/env bash
# Deja SSH solo con clave y sin entrada directa de root. Se corre desde el usuario nuevo, después
# de comprobar que entra con su clave, y con otra sesión abierta por si algo sale mal:
#
#   sudo bash ssh-cerrar.sh
#
# Para deshacerlo: borrar /etc/ssh/sshd_config.d/00-portfolio.conf y recargar ssh.
set -euo pipefail

[ "$(id -u)" = 0 ] || { echo "Correlo con sudo." >&2; exit 1; }
user="${SUDO_USER:-}"
[ -n "$user" ] && [ "$user" != root ] \
  || { echo "Correlo con sudo desde el usuario nuevo, no como root: así se comprueba que ese usuario entra." >&2; exit 1; }
home_dir="$(getent passwd "$user" | cut -d: -f6)"
[ -s "$home_dir/.ssh/authorized_keys" ] || { echo "$user no tiene claves SSH: te quedarías afuera." >&2; exit 1; }

# 00- gana a los archivos que agrega el proveedor, porque sshd se queda con el primer valor.
conf=/etc/ssh/sshd_config.d/00-portfolio.conf
printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin no\n' > "$conf"
if ! sshd -t; then
  rm -f "$conf"
  echo "La configuración de SSH no es válida: no cambié nada." >&2
  exit 1
fi
systemctl reload ssh

echo "Aplicado:"
sshd -T | grep -E '^(passwordauthentication|kbdinteractiveauthentication|permitrootlogin) '
echo "Sesiones abiertas no se cortan. Probá en otra terminal antes de cerrar esta."
