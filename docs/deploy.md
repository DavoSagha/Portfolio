# Despliegue

Pasos para publicar el sitio en un VPS. El stack ya está probado en local con la configuración de producción (ver [Qué está probado](#qué-está-probado)). Lo que falta requiere cuentas, un dominio y secretos propios.

Ningún secreto se versiona ni se comparte por chat: todos van al `.env` del servidor o a tu gestor de contraseñas.

## Proveedor y dominio

Precios consultados en los sitios oficiales el 5 de noviembre de 2026. Confirmalos antes de comprar.

### VPS

Con todos los servicios en reposo, el stack usó unos 385 MiB de RAM (medido en local con `docker stats`). Necesita 2 GB o más, porque construir las imágenes en el servidor consume bastante más que correrlas.

| Opción                         | CPU y RAM    | Disco      | Tráfico    | Precio por mes                                                                    | A tener en cuenta                                                           |
| ------------------------------ | ------------ | ---------- | ---------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [Hetzner CX23][hetzner-cx]     | 2 vCPU, 4 GB | 40 GB NVMe | 20 TB      | €5,99 sin IVA                                                                     | **Figura sin stock.** Solo en Europa.                                       |
| [Hetzner CPX12][hetzner-cpx]   | 1 vCPU, 2 GB | 40 GB NVMe | 20 TB      | €11,99 sin IVA                                                                    | Europa. En EE. UU. el más chico es el CPX11, con 2 vCPU y 2 GB, a €17,99.   |
| [DigitalOcean Basic][do]       | 1 vCPU, 2 GB | 50 GB SSD  | 2.000 GiB  | USD 12                                                                            | El de 2 vCPU y 4 GB cuesta USD 24.                                          |
| [Contabo Cloud VPS 4][contabo] | 4 vCPU, 8 GB | 100 GB SSD | Sin límite | €4,40 con impuestos, en contrato de 24 meses. Muestra también €5,50 sin aclararlo | Puerto de 200 Mbit/s. Cargo de alta en contrato mensual, sin monto visible. |

**Recomendación:** Hetzner CX23, si tiene stock cuando compres: es el mejor precio con condiciones claras y alcanza con margen. Si sigue sin stock, DigitalOcean de 2 GB y USD 12, con la memoria virtual del paso 3: cuesta más que Contabo, pero el precio es claro y se paga por mes, sin contrato de 24 meses. Elegí Contabo solo si el precio final en el checkout te cierra.

No medí la latencia desde Argentina ni el rendimiento real de ningún proveedor. Un servidor en Europa va a tener más latencia desde Argentina que uno en el este de EE. UU.

### Dominio

| Opción                     | Alta        | Renovación                                                     | A tener en cuenta                |
| -------------------------- | ----------- | -------------------------------------------------------------- | -------------------------------- |
| [`.com` en Porkbun][pork]  | USD 11,81   | Dice que el precio se mantiene, sin dar la cifra de renovación | Incluye privacidad WHOIS gratis. |
| [`.com.ar` en NIC.ar][nic] | $8.500 ARS  | $8.500 ARS                                                     | El más barato.                   |
| [`.ar` en NIC.ar][nic]     | $25.500 ARS | $25.500 ARS                                                    |                                  |

[Cloudflare Registrar][cf] vende al costo, pero su página no publica el precio del `.com`.

**Recomendación:** `davidsaghatelyan.com`, porque se lee igual en cualquier país y estás buscando también trabajo remoto. El 5 de noviembre de 2026 el registro público (RDAP) lo devolvía como no registrado. Confirmá la disponibilidad al comprarlo.

### Servicios externos

| Uso                      | Opción                | Costo                                                                     |
| ------------------------ | --------------------- | ------------------------------------------------------------------------- |
| Copia externa de backups | [Backblaze B2][b2]    | Primeros 10 GB gratis, después USD 6,95 por TB por mes                    |
| Aviso si el sitio se cae | [UptimeRobot][uptime] | Plan gratis: 50 monitores cada 5 minutos, apto para proyectos comerciales |
| Aviso si no hay backup   | [Healthchecks.io][hc] | Plan gratis: hasta 20 chequeos                                            |

[hetzner-cx]: https://www.hetzner.com/cloud/cost-optimized/
[hetzner-cpx]: https://www.hetzner.com/cloud/regular-performance/
[do]: https://www.digitalocean.com/pricing/droplets
[contabo]: https://contabo.com/en/vps/
[pork]: https://porkbun.com/tld/com
[nic]: https://nic.ar/es/dominios/aranceles
[cf]: https://www.cloudflare.com/products/registrar/
[b2]: https://www.backblaze.com/cloud-storage/pricing
[uptime]: https://uptimerobot.com/pricing/
[hc]: https://healthchecks.io/pricing/

## Pasos

### 1. En tu computadora: generar la clave de los backups

Los backups se cifran con [age](https://age-encryption.org). El servidor solo tiene la clave pública: si alguien lo compromete, no puede leerlos.

```bash
docker build -f docker/backup/Dockerfile -t portfolio-backup-tools .
docker run --rm --entrypoint age-keygen portfolio-backup-tools > age.key
```

1. Guardá el contenido de `age.key` en tu gestor de contraseñas. **Sin esta clave, los backups no se pueden recuperar.**
2. Anotá la línea `# public key: age1…`: es el valor de `BACKUP_AGE_RECIPIENT`.
3. Borrá `age.key` de la carpeta cuando lo hayas guardado.

### 2. Crear el repositorio y subir el código

Antes de hacer push, verificá que no se suban archivos privados:

```bash
git ls-files | grep -E '^private/|spec\.md$|^\.env$|defensa-tecnica' ; echo "tiene que no listar nada"
```

Creá el repositorio en GitHub, hacé push de `main` y mirá que el CI quede en verde. **El CI nunca corrió**, porque hasta ahora no hay remoto.

### 3. Preparar el servidor

Creá un VPS con Ubuntu LTS y tu clave SSH, y conectate:

```bash
# Memoria virtual: necesaria con 2 GB de RAM para construir las imágenes.
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Actualizaciones de seguridad automáticas.
apt update && apt upgrade -y && apt install -y unattended-upgrades git
dpkg-reconfigure -f noninteractive unattended-upgrades

# Docker, con el script oficial.
curl -fsSL https://get.docker.com | sh

# Firewall: solo SSH y web.
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw --force enable
```

En `/etc/ssh/sshd_config` dejá `PasswordAuthentication no` y reiniciá SSH con `systemctl restart ssh`, sin cerrar la sesión actual hasta comprobar que podés volver a entrar.

### 4. Apuntar el dominio

En tu registrador, creá un registro `A` del dominio hacia la IP del VPS (y un `AAAA` si tiene IPv6). Caddy necesita que resuelva para pedir el certificado. Comprobalo con `dig +short tu-dominio.com`.

### 5. Configurar el `.env`

```bash
git clone <url-del-repo> /opt/portfolio && cd /opt/portfolio
cp .env.example .env && chmod 600 .env
openssl rand -hex 32   # usalo como POSTGRES_PASSWORD: en hexadecimal no hace falta escaparlo en la URL
nano .env
```

Variables de producción:

| Variable                   | Valor                             |
| -------------------------- | --------------------------------- |
| `APP_ENV`                  | `production`                      |
| `POSTGRES_PASSWORD`        | el valor generado                 |
| `SITE_URL`                 | `https://tu-dominio.com`          |
| `SITE_ADDRESS`             | `tu-dominio.com` (sin `https://`) |
| `HTTP_PORT` / `HTTPS_PORT` | `80` / `443`                      |
| `BACKUP_AGE_RECIPIENT`     | la clave pública del paso 1       |
| `SMTP_*`, `CONTACT_TO`     | ver el paso 8                     |

Para no repetir los archivos de compose en cada comando:

```bash
echo "alias dc='docker compose -f compose.yaml -f compose.prod.yaml'" >> ~/.bashrc && source ~/.bashrc
```

Si falta una variable obligatoria, compose se niega a arrancar y la nombra. Si la contraseña es la de ejemplo o `SITE_URL` no usa https, la API no arranca.

### 6. Levantar el sitio

```bash
dc up -d --build
dc ps                                   # todo healthy
curl -I https://tu-dominio.com          # 200, con Strict-Transport-Security
```

En producción el seed no corre solo. Cargá el contenido inicial y creá tu usuario (ambos comandos te hablan por la terminal):

```bash
dc exec api node dist/cli/seed.js
dc exec -it api node dist/cli/admin-create.js
```

### 7. Cargar lo que no está en el seed

Desde `https://tu-dominio.com/admin`:

1. **CV:** subí los tres PDF. Backend es el principal por defecto.
2. **Perfil:** subí la foto. Se guarda sin metadatos.
3. **Proyectos:** revisá el contenido, y cargá el aporte de la carta digital y los textos que confirmes.

Después, `dc exec api node dist/cli/content-todos.js` tiene que responder "Sin contenido pendiente".

### 8. Email de contacto (Gmail)

1. Activá la verificación en dos pasos y creá una contraseña de aplicación en tu cuenta de Google.
2. Completá en el `.env`: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER` y `SMTP_PASS` (esa contraseña), y `CONTACT_TO` (dónde recibís los mensajes).
3. Aplicá el cambio con `dc up -d api`.
4. Mandate un mensaje desde una ventana privada. **Esto todavía no se probó con Gmail real.** En `/admin/mensajes` tiene que figurar "Enviado por email".

### 9. Destino externo de los backups (Backblaze B2)

1. Creá un bucket **privado** y una clave de aplicación limitada a ese bucket.
2. En el servidor, creá `/opt/portfolio/rclone.conf` con permisos `600`:

   ```ini
   [offsite]
   type = b2
   account = <key id>
   key = <application key>
   hard_delete = true
   ```

3. Agregá al `.env`: `RCLONE_CONF=./rclone.conf` y `BACKUP_RCLONE_REMOTE=offsite:<nombre-del-bucket>`.
4. Aplicá y probá:

   ```bash
   dc up -d backup
   dc exec backup backup
   dc exec backup rclone lsf offsite:<nombre-del-bucket>
   ```

Tiene que aparecer el archivo. **La subida a B2 no se probó:** la prueba local usa una carpeta como destino externo.

El backup corre cada día a las 6:00 UTC (3:00 en Argentina). Conserva 14 copias en el servidor y 90 días en el destino externo.

### 10. Monitoreo

1. **Disponibilidad:** en UptimeRobot, creá un monitor HTTP de `https://tu-dominio.com/api/v1/health`. Esa ruta consulta también la base.
2. **Backups:** en Healthchecks.io, creá un chequeo con período de 1 día, copiá su URL a `BACKUP_HEARTBEAT_URL` en el `.env` y aplicá con `dc up -d backup`. Avisa si un día no llega el backup.

Para revisar a mano:

```bash
dc ps                       # estado y healthchecks; backup queda unhealthy tras 26 h sin backup
dc logs --tail 100 api      # los logs rotan solos: 5 archivos de 10 MB por servicio
df -h && docker system df   # espacio en disco
```

### 11. Probar la restauración en el servidor

Hacelo una vez antes de darlo por terminado, y después cada tanto. Ver el procedimiento de abajo.

## Restaurar un backup

**Reemplaza toda la base y todos los archivos.** El comando verifica la clave y el archivo antes de tocar nada, y pide que escribas `SI`.

```bash
# 1. Si hay que traerlo del destino externo (si no, ya está en /backups):
dc run --rm backup rclone copy offsite:<bucket>/<archivo> /backups/
dc run --rm backup ls -1 /backups

# 2. Copiá la clave privada al servidor solo por este momento.
nano age.key && chmod 600 age.key

# 3. Restaurar.
dc stop api web
dc run --rm -v "$PWD/age.key:/run/age.key:ro" backup restore /backups/<archivo>
dc start api web

# 4. Borrá la clave.
shred -u age.key
```

Comprobá el sitio, el CV, la foto y el login. **Para reconstruir en un servidor nuevo:** hacé los pasos 3 a 6 sin el seed ni `admin-create`, y después restaurá. Tu usuario y tu contraseña vuelven con el backup.

## Actualizar

```bash
cd /opt/portfolio && git pull
dc exec backup backup          # backup antes de cambiar nada
dc up -d --build               # las migraciones corren solas al iniciar la API
docker image prune -f
```

## Secretos

Ver [seguridad: secretos](seguridad.md#secretos-respaldo-y-recuperación).

## Qué está probado

**Probado en local**, con `compose.prod.yaml` y `APP_ENV=production`:

| Qué                                                                                                                       | Cómo                          |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Backup automático por cron, cifrado, y restauración completa tras borrar todos los volúmenes, comparando datos y archivos | `npm run test:restore`        |
| Clave incorrecta, archivo dañado y respuesta `NO`: no se cambia nada                                                      | `npm run test:restore`        |
| La API rechaza la contraseña de ejemplo, y el seed no corre solo                                                          | `npm run test:restore`        |
| HTTPS con la CA interna de Caddy, redirección desde HTTP, HSTS, CSP, y solo Caddy publica puertos                         | `scripts/https-smoke-test.sh` |
| Lighthouse móvil: 97 a 100 en las cuatro categorías, en `/`, `/proyectos` y un proyecto (3 corridas)                      | Lighthouse 13.6.0             |

Lighthouse corrió en local, sin la latencia real de un servidor: conviene repetirlo con el sitio publicado.

**No probado**, porque requiere algo que todavía no existe:

- Emisión real del certificado de Let's Encrypt.
- Envío real por Gmail. El código de envío se probó contra un servidor SMTP de prueba.
- Subida real a Backblaze B2. Se probó con una carpeta como destino.
- Los comandos de los pasos 3 y 4, los monitores externos y el CI de GitHub.
- Construir las imágenes en un VPS de 2 GB.
