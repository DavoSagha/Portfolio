# Despliegue

Guía para publicar el sitio. La **parte 1** se hace desde la PC, antes de pagar el servidor. La **parte 2** se hace después de pagar, y lo que solo se puede probar ahí figura en [una lista aparte](#solo-se-puede-probar-en-el-servidor-real).

Ningún secreto se versiona ni se comparte por chat. Los comandos de esta guía se corren en una terminal propia. En Windows, usá Git Bash.

## Decisiones

| Qué               | Elección                                                                            | Costo                                                               |
| ----------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Servidor          | [DonWeb Cloud Server][donweb]: 2 vCPU, 2 GB, 20 GB, 1 mes                           | $9.708,67 ARS por mes con IVA y descuento; $21.574,80 sin descuento |
| Sistema operativo | Ubuntu LTS (24.04 o 26.04)                                                          | Incluido                                                            |
| Dominio           | Subdominio gratuito de [DuckDNS][duckdns]                                           | Gratis                                                              |
| Backups           | [Backup estándar de DonWeb][donweb-backup], semanal                                 | Incluido                                                            |
| Backups externos  | Apagados. Se pueden [activar](#activar-los-backups-externos) con [Backblaze B2][b2] | Primeros 10 GB gratis                                               |
| Email             | Gmail con contraseña de aplicación                                                  | Gratis                                                              |
| Monitoreo         | [UptimeRobot][uptime]                                                               | Plan gratis                                                         |

Los precios de DonWeb se leyeron el 5 de noviembre de 2026 en una página con el texto mal renderizado: confirmalos en el carrito. Ver las decisiones [D-040](decisiones.md#d-040-donweb-y-duckdns) y [D-041](decisiones.md#d-041-backups-externos-opcionales).

[donweb]: https://donweb.com/es-ar/cloud-server-vps
[donweb-backup]: https://soporte.donweb.com/hc/es/articles/28733024934292--Qu%C3%A9-son-y-c%C3%B3mo-funcionan-las-Copias-de-Seguridad-en-mi-Cloud-Server
[duckdns]: https://www.duckdns.org
[b2]: https://www.backblaze.com/cloud-storage/pricing
[uptime]: https://uptimerobot.com/pricing/
[hc]: https://healthchecks.io/pricing/

## ¿Entra en el servidor?

**Sí, y se puede construir en el servidor.** Lo midió `scripts/vps-sim.sh`, con un Docker aislado limitado a 2 vCPU. Construyó desde cero, levantó producción, recibió 2000 pedidos y reconstruyó sin caché con el sitio andando.

| Medición                                | 2048 MiB + 2 GB de swap | 1740 MiB + 2 GB de swap (reserva para Ubuntu) |
| --------------------------------------- | ----------------------- | --------------------------------------------- |
| Construcción desde cero                 | 120 s, sin errores      | 135 s, sin errores                            |
| RAM en reposo                           | 267 MiB                 | 278 MiB                                       |
| Carga: 2000 pedidos, 16 a la vez        | Todos 200, p95 de 77 ms | Todos 200, p95 de 145 ms                      |
| Reconstrucción con el sitio andando     | 109 s, 0 errores        | 115 s, 0 errores                              |
| Pico de esa reconstrucción (RAM + swap) | 1552 MiB, 90 de swap    | 1389 MiB, 260 de swap                         |
| Respuesta más lenta durante esa etapa   | 2,5 s                   | 8,1 s                                         |
| Procesos matados por falta de memoria   | 0                       | 0                                             |

La prueba corrió en una PC con otro disco y otros procesadores, así que los tiempos reales pueden ser peores. Mientras se reconstruye, el sitio puede responder lento.

### Disco, sobre 20 GB

| Parte                                             | Tamaño     | Origen                     |
| ------------------------------------------------- | ---------- | -------------------------- |
| Ubuntu                                            | ~4 GB      | Estimado, no medido        |
| Swap                                              | 2 GB       | Fijo                       |
| Imágenes                                          | 1,7 GB     | Medido                     |
| Base, con 365.000 eventos (un año a 1000 por día) | 255 MB     | Medido                     |
| Archivos, con 10 MB de relleno                    | 10 MB      | Medido                     |
| 14 backups, de 19,5 MB cada uno, si se activan    | 273 MB     | Medido, por 14             |
| Logs de contenedores, como máximo                 | 250 MB     | Por configuración          |
| Logs del sistema, como máximo                     | 200 MB     | Por configuración          |
| **En uso normal**                                 | **~9 GB**  |                            |
| Caché de construcción, durante una actualización  | ~5 GB      | Medido; se limpia al final |
| Imágenes viejas, durante una actualización        | ~1,3 GB    | Se limpian al final        |
| **Pico**                                          | **~15 GB** |                            |

**Plan B, si en el servidor real falla o tarda demasiado:** construir en otro lado. Con el repo privado, GitHub Packages incluye 500 MB compartidos con los artifacts, y las imágenes ocupan más. Mientras sea privado, conviene construir en la PC y mandarlas por SSH, sin registro ni token:

```bash
docker compose -f compose.yaml -f compose.prod.yaml build
docker save portfolio-api portfolio-web | gzip | ssh -p <puerto> root@<ip> 'gunzip | docker load'
```

Con el repo público, GitHub Actions puede publicar en GHCR sin ese límite. Ninguna de las dos variantes hizo falta ni se probó.

## Parte 1: antes de pagar

### 1. Crear el repositorio privado y subir `main`

1. Comprobá que no se suba nada privado. El comando no tiene que listar nada:

   ```bash
   git ls-files | grep -E '^private/|spec\.md$|^\.env$|defensa-tecnica|age\.key|rclone\.conf'
   ```

2. En GitHub, creá un repositorio **privado y vacío**, sin README ni licencia.
3. Subí `main`:

   ```bash
   git remote add origin git@github.com:<usuario>/<repo>.git
   git push -u origin main
   ```

4. En la pestaña **Actions**, esperá que los 5 trabajos queden en verde. Con el plan gratuito, en un repo privado el uso se bloquea al agotar lo incluido, sin cobrar si no hay método de pago.
5. El trabajo "Escaneo de secretos" corre gitleaks. Es gratis en cuentas personales; en una organización pide una licencia gratuita.

Hacer público el repo es una decisión aparte, después del CI y de la revisión de secretos.

### 2. Probar Gmail real

1. Activá la verificación en dos pasos y creá una [contraseña de aplicación](https://myaccount.google.com/apppasswords). Las cuentas de una organización o con Protección Avanzada pueden no tener esa opción.
2. Corré `bash scripts/test-gmail.sh`. La primera vez crea `~/.portfolio-secrets/gmail.env`.
3. Completalo con `notepad "$(cygpath -w ~/.portfolio-secrets/gmail.env)"`: `SMTP_USER` y `SMTP_FROM` con tu cuenta, `SMTP_PASS` con la contraseña de aplicación sin espacios, y `CONTACT_TO` con la casilla donde querés recibir los mensajes.
4. Volvé a correr el script. Levanta un stack aislado con el código de producción, manda un mensaje por el formulario y lee el resultado en la base.
5. Buscá el mensaje en `CONTACT_TO`, también en spam. **Recién ahí la prueba está completa.**

### 3. Reservar el subdominio

En [DuckDNS](https://www.duckdns.org), iniciá sesión y creá el subdominio. Guardá el token en el gestor de contraseñas. La IP se carga en el paso 6.

### 4. Revisar DonWeb antes de pagar

| Revisar                     | Qué dice DonWeb hoy                                                                    | Qué hacer                                                                                                                                                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Acceso root por SSH         | Publicado: root en Linux, con contraseña o clave                                       | Confirmar en el formulario de compra                                                                                                                                                                                           |
| Puerto SSH                  | Publicado: no usa el 22; figura en Software y Accesos, pestaña SSH                     | Anotarlo después de instalar. `setup.sh` lo detecta                                                                                                                                                                            |
| Ubuntu                      | Publicado: Ubuntu 24.04 y 26.04                                                        | Elegir uno al instalar                                                                                                                                                                                                         |
| Plan                        | Publicado: 2 vCPU, 2 GB, 20 GB NVMe, 2 TB de transferencia                             | Confirmarlo en el configurador, y si los 20 GB excluyen al sistema                                                                                                                                                             |
| Puertos 80 y 443 de entrada | Publicado: no figuran entre los puertos bloqueados                                     | Preguntar si hay un firewall en el panel, y si viene abierto                                                                                                                                                                   |
| Puerto 587 de salida        | **No publicado**                                                                       | **Preguntar a soporte.** Sin él, Gmail no funciona                                                                                                                                                                             |
| IP pública                  | Publicado: una IPv4 y una IPv6 dedicadas, ubicadas en Argentina o EE. UU.              | Preguntar si la IPv4 se mantiene al reiniciar                                                                                                                                                                                  |
| Backup                      | Publicado: semanal, incluido; conserva solo la última copia; restauración por ticket   | **Preguntar** cuánto tarda restaurar, si reemplaza todo el servidor, si la copia es consistente con una base de datos en uso, qué pasa con la copia al dar de baja el servicio, y si se puede pedir una restauración de prueba |
| Snapshots                   | Publicado: hasta 2 sin cargo. Su duración figura como 28, 30 o 90 días según la página | Preguntar cuánto duran. DonWeb aclara que no son un backup                                                                                                                                                                     |
| Renovación                  | **No publicado**                                                                       | **Preguntar** si es automática, a qué precio y cómo se da de baja                                                                                                                                                              |
| Precio                      | Muestra 55% de descuento                                                               | Confirmar en el carrito el total del primer mes y el de los siguientes                                                                                                                                                         |

## Parte 2: después de pagar

**Estos comandos todavía no se ejecutaron en un servidor real.**

### 5. Preparar el servidor

Instalá Ubuntu desde el panel. Si te deja, elegí tu clave SSH pública. Si no tenés una, creala con `ssh-keygen -t ed25519`. Reemplazá `<puerto>` e `<ip>` por los del panel.

```bash
# Desde la PC.
cat ~/.ssh/id_ed25519.pub | ssh -p <puerto> root@<ip> 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys'
scp -P <puerto> scripts/server/setup.sh root@<ip>:/root/
ssh -p <puerto> root@<ip> 'bash /root/setup.sh'
```

Instala swap, actualizaciones automáticas, Docker y firewall, y deja SSH solo con clave. Antes de cerrar la sesión, abrí otra terminal y comprobá que entrás con `ssh -p <puerto> root@<ip>`.

### 6. Apuntar el subdominio

Desde la PC, en la carpeta del repo. El script pide el token sin mostrarlo:

```bash
bash scripts/duckdns-update.sh <subdominio> <ip>
```

### 7. Bajar el código

Con el repo privado, el servidor usa una clave de solo lectura para ese repo:

```bash
# En el servidor.
ssh-keygen -t ed25519 -f ~/.ssh/portfolio_deploy -N '' -C portfolio-servidor
cat ~/.ssh/portfolio_deploy.pub
```

Pegá esa línea en GitHub, en **Settings → Deploy keys** del repo, sin permiso de escritura. Después:

```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/portfolio_deploy\n' >> ~/.ssh/config
git clone git@github.com:<usuario>/<repo>.git /opt/portfolio
cd /opt/portfolio
bash scripts/server/preflight.sh <subdominio>.duckdns.org
```

`preflight.sh` solo lee: comprueba sistema, swap, disco, DNS y la salida a Gmail y Let's Encrypt. La salida a B2 se informa, sin marcarla como problema. Si dice `MAL`, resolvelo antes de seguir.

### 8. Configurar los secretos

```bash
# En el servidor.
cd /opt/portfolio
cp deploy/production.env.example .env && chmod 600 .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 32)/" .env
sed -i 's/<subdominio>/TU-SUBDOMINIO/g' .env   # reemplazá TU-SUBDOMINIO
nano .env
```

Completá los datos `SMTP_*` y `CONTACT_TO` que ya probaste. Las variables de backup quedan comentadas. Guardá también `POSTGRES_PASSWORD` en el gestor de contraseñas.

### 9. Levantar el sitio

```bash
# En el servidor.
echo "alias dc='docker compose -f compose.yaml -f compose.prod.yaml'" >> ~/.bashrc && source ~/.bashrc
cd /opt/portfolio
dc up -d --build
dc ps                                            # todo healthy
curl -I https://<subdominio>.duckdns.org         # 200, con Strict-Transport-Security
dc exec api node dist/cli/seed.js
dc exec -it api node dist/cli/admin-create.js
```

No borres el volumen `caddy_data`: guarda el certificado. Let's Encrypt limita las repeticiones del mismo certificado a 5 por semana. `duckdns.org` está en la Public Suffix List, así que tu subdominio no comparte el resto de los límites con otros usuarios.

### 10. Cargar los archivos y el contenido

Desde `https://<subdominio>.duckdns.org/admin`:

1. **CV:** subí **solo** los PDF terminados en `-Web`: `CV-David-Saghatelyan-Backend-Web.pdf`, `-Mainframe-Web.pdf` y `-Soporte-Web.pdf`. Son los que no tienen el celular.
2. **Perfil:** subí la foto. Se guarda sin metadatos.
3. **Proyectos:** escribí "Mi aporte" de la carta digital y las secciones que falten. Una sección vacía no se muestra.

Comprobá desde la PC que lo publicado sea idéntico a los `-Web`. Cada par de hashes tiene que coincidir:

```bash
for p in Backend Mainframe Soporte; do
  sha256sum "private/cv/CV-David-Saghatelyan-$p-Web.pdf"
  curl -fsS "https://<subdominio>.duckdns.org/cv/${p,,}" | sha256sum
done
```

Cada descarga suma un evento a las métricas. Después, en el servidor, `dc exec api node dist/cli/content-todos.js` tiene que responder "Sin contenido pendiente".

### 11. Probar el email en el servidor

Mandate un mensaje desde una ventana privada. En `/admin/mensajes` tiene que figurar "Enviado por email".

### 12. Monitoreo

En UptimeRobot, un monitor HTTP de `https://<subdominio>.duckdns.org/api/v1/health`. Esa ruta consulta también la base.

Para revisar a mano:

```bash
dc ps                       # todo healthy
dc logs --tail 100 api      # los logs rotan solos: 5 archivos de 10 MB por servicio
df -h && docker system df   # espacio en disco
```

### 13. Comprobar la recuperación y medir

1. Confirmá en el panel de DonWeb que ya existe una copia semanal. Si soporte acepta una [restauración de prueba](#restaurar-desde-donweb), hacela antes de cargar datos que no quieras perder.
2. Repetí Lighthouse con el sitio publicado.

## Backups

Con esta configuración, el único backup es el [estándar de DonWeb][donweb-backup]. El servicio de backups del proyecto no corre: no hay contenedor ni cron, y el sitio no lo necesita.

**Qué se puede perder:**

- **Hasta 7 días:** los mensajes y los cambios del panel posteriores a la última copia.
- **Una sola copia:** un error que notes después del backup siguiente ya está en la única copia.
- **Sin confirmar:** DonWeb no publica si la copia es consistente con una base de datos en uso ni qué pasa con ella al dar de baja el servicio. La restauración tampoco se probó.
- **Sin cifrado propio:** la copia incluye el disco completo, con el `.env`.

Los CV y la foto también se pueden volver a subir desde la PC, y los textos del panel conviene guardarlos aparte.

### Restaurar desde DonWeb

1. Pedí la restauración por ticket a soporte y confirmá antes qué reemplaza.
2. Al terminar, comprobá con `dc ps` que todo esté `healthy`, y revisá el sitio, el CV, la foto y el login.

### Activar los backups externos

Copias diarias cifradas en [Backblaze B2][b2], probadas con restauración completa en local. Permiten recuperar hasta 90 días atrás sin depender de DonWeb.

**Desde la PC, con Git Bash:**

1. Generá la clave. Muestra solo la pública, y no pisa una existente:

   ```bash
   bash scripts/backup-key-generate.sh
   notepad "$(cygpath -w ~/.portfolio-secrets/age.key)"
   ```

   Guardá el contenido en tu gestor de contraseñas. **Sin esta clave, los backups no se pueden recuperar.**

2. En Backblaze, creá una cuenta, un bucket **privado** y una clave de aplicación limitada a ese bucket, con permisos de lectura y escritura.
3. Corré `bash scripts/test-b2.sh`. La primera vez crea `rclone.conf` y `b2.env` en `~/.portfolio-secrets/`.
4. Completá con el Bloc de notas `account` (key ID) y `key` (application key) en `rclone.conf`, y el bucket en `b2.env`: `BACKUP_RCLONE_REMOTE=offsite:<bucket>`.
5. Volvé a correr el script. Sube un backup real, borra los datos del stack aislado, baja el backup de B2, restaura y compara. Al final borra de B2 solo el archivo que creó.
6. Copiá las credenciales al servidor y borrá la clave privada de la PC:

   ```bash
   scp -P <puerto> ~/.portfolio-secrets/rclone.conf root@<ip>:/opt/portfolio/rclone.conf
   shred -u ~/.portfolio-secrets/age.key
   ```

**En el servidor:**

1. Ajustá las credenciales y editá el `.env`:

   ```bash
   cd /opt/portfolio
   sed -i 's/\r$//' rclone.conf && chmod 600 rclone.conf
   nano .env
   ```

2. Descomentá `COMPOSE_PROFILES=backups`, `BACKUP_CRON`, `BACKUP_KEEP_LOCAL`, `BACKUP_KEEP_REMOTE_DAYS` y `RCLONE_CONF`. Completá `BACKUP_AGE_RECIPIENT` con el contenido de `age.pub` y `BACKUP_RCLONE_REMOTE`.
3. Levantá el servicio y probalo:

   ```bash
   dc up -d --build
   dc exec backup backup
   dc exec backup rclone lsf offsite:<bucket>
   ```

4. Opcional: en [Healthchecks.io][hc], un chequeo con período de 1 día. Copiá su URL a `BACKUP_HEARTBEAT_URL` y aplicá con `dc up -d backup`.
5. Hacé una vez el [procedimiento de restauración](#restaurar-un-backup-externo).

El backup corre cada día a las 6:00 UTC (3:00 en Argentina). Conserva 14 copias en el servidor y 90 días en B2. `dc ps` muestra `backup` como `unhealthy` tras 26 horas sin backup. Si falta `BACKUP_AGE_RECIPIENT`, el servicio no arranca: nunca genera un backup sin cifrar.

Para apagarlos otra vez, volvé a comentar `COMPOSE_PROFILES` y corré `dc --profile backups rm -sf backup`. Los backups ya guardados no se borran.

### Restaurar un backup externo

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

Comprobá el sitio, el CV, la foto y el login. **Para reconstruir en un servidor nuevo:** hacé los pasos 5 a 9 sin el seed ni `admin-create`, activá el servicio y después restaurá. Tu usuario y tu contraseña vuelven con el backup.

## Actualizar

```bash
cd /opt/portfolio && git pull
dc up -d --build               # las migraciones corren solas al iniciar la API
docker image prune -f && docker builder prune -af   # libera hasta 6 GB
```

Antes de una actualización con migraciones, creá un snapshot desde el panel de DonWeb, para poder volver atrás. Si activaste los backups externos, corré también `dc exec backup backup`.

El sitio puede responder lento mientras se construye. Mirá el espacio con `df -h` antes de empezar: el pico necesita unos 6 GB libres.

## Cambiar a un dominio propio

1. Comprá el dominio y creá un registro `A` hacia la IP del servidor. Comprobalo con `dig +short tu-dominio.com`.
2. En el `.env`, cambiá `SITE_URL=https://tu-dominio.com` y `SITE_ADDRESS=tu-dominio.com`.
3. Para que los links viejos sigan funcionando, agregá al final del `Caddyfile`:

   ```
   <subdominio>.duckdns.org {
   	redir https://{$SITE_ADDRESS}{uri} permanent
   }
   ```

4. Aplicá con `dc up -d`. Caddy pide el certificado nuevo solo.
5. Actualizá el monitor de UptimeRobot y los links en LinkedIn, GitHub y el CV.
6. Si `SITE_ADDRESS` deja de estar en DuckDNS, mantené el subdominio apuntando a la IP mientras queden links viejos.

Los datos, los CV y las contraseñas no cambian. No hace falta reconstruir las imágenes.

## Secretos

Ver [seguridad: secretos](seguridad.md#secretos-respaldo-y-recuperación).

## Qué está probado

### Probado en local

| Qué                                                                                                                       | Cómo                          |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Construir, levantar, recibir carga y reconstruir con 2 GB simulados y swap                                                | `scripts/vps-sim.sh`          |
| Backup automático por cron, cifrado, y restauración completa tras borrar todos los volúmenes, comparando datos y archivos | `npm run test:restore`        |
| Clave incorrecta, archivo dañado y respuesta `NO`: no se cambia nada                                                      | `npm run test:restore`        |
| La API rechaza la contraseña de ejemplo, y el seed no corre solo                                                          | `npm run test:restore`        |
| HTTPS con la CA interna de Caddy, redirección desde HTTP, HSTS, CSP, y solo Caddy publica puertos                         | `scripts/https-smoke-test.sh` |
| Lighthouse móvil: 97 a 100 en las cuatro categorías, en `/`, `/proyectos` y un proyecto (3 corridas)                      | Lighthouse 13.6.0             |
| Generar la clave: par verificado, no pisa una existente ni se crea dentro del repo                                        | `backup-key-generate.sh`      |
| Lógica de la prueba de Gmail, con un servidor SMTP de prueba; en producción rechaza un servidor sin TLS                   | `test-gmail.sh`               |
| Lógica de la prueba de B2, con una carpeta como destino, también con archivos editados en Windows                         | `test-b2.sh`                  |
| La configuración con un subdominio de DuckDNS y la redirección al cambiar de dominio                                      | `caddy validate`              |
| Sin variables de backup: el sitio anda con HTTPS y el servicio no existe                                                  | `scripts/https-smoke-test.sh` |
| Con el servicio activado y sin clave pública: no arranca                                                                  | `npm run test:restore`        |

### Probado con cuentas reales

- Envío real por Gmail desde la PC: el mensaje llegó, sin caer en spam.
- El CI de GitHub, en el repo privado.

### Sin probar

- Subida, descarga y restauración real con B2: solo hace falta si se activan los backups externos.

### Solo se puede probar en el servidor real

- La restauración del backup de DonWeb y el contenido de esa copia.

- `setup.sh`: solo pasó análisis estático.
- `preflight.sh` en un servidor con acceso real a internet desde DonWeb.
- `duckdns-update.sh` con un token real.
- La entrada a los puertos 80 y 443, y la salida al 587 desde DonWeb.
- La emisión real del certificado de Let's Encrypt.
- Construir en el hardware real, con su disco y sus procesadores.
- El espacio real que ocupa Ubuntu.
- Los monitores externos.
- Lighthouse con la latencia real.
