# Seguridad

> Estado: las medidas de las Fases 1 a 5 están implementadas y cubiertas por pruebas, salvo lo que requiere el servidor real (ver [qué está probado](deploy.md#qué-está-probado)).

## Activos

1. Acceso al panel: credenciales y sesiones del administrador.
2. Integridad del contenido público y del CV.
3. Mensajes de contacto, que contienen nombre y email de terceros.
4. Secretos: base de datos, SMTP y backups.
5. Disponibilidad del sitio.

## Amenazas y medidas

| Amenaza                                     | Medida                                                                                                                                                                                                                                                           | Fase |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Registro o creación de cuentas por terceros | Sin endpoint de registro. El único admin se crea con `admin:create` desde la consola del servidor, que falla si ya existe uno.                                                                                                                                   | 2    |
| Robo de la base, que expone contraseñas     | Argon2id con los parámetros recomendados por OWASP (m = 19 MiB, t = 2, p = 1 como mínimo).                                                                                                                                                                       | 2    |
| Robo de la base, que expone sesiones        | En la base solo se guarda el SHA-256 del token de sesión.                                                                                                                                                                                                        | 2    |
| Fuerza bruta en el login                    | Bloqueo por `hash(usuario + IP)` tras 5 fallos (15 min), límite general por IP y `Retry-After`.                                                                                                                                                                  | 2    |
| Bloqueo del admin provocado por un tercero  | Bloqueo por usuario + IP, no por cuenta (ver [D-014](decisiones.md#d-014-bloqueo-de-login-por-usuario--ip)).                                                                                                                                                     | 2    |
| Enumeración de usuarios                     | Mismo 401 y mismo tiempo de respuesta, exista o no el usuario: Argon2 corre siempre contra un hash ficticio.                                                                                                                                                     | 2    |
| Robo de la cookie de sesión                 | Cookie `HttpOnly`, `Secure` y `SameSite=Strict`, HTTPS obligatorio y HSTS.                                                                                                                                                                                       | 2    |
| Sesiones eternas o no revocables            | Expiración por inactividad (2 h) y absoluta (7 días). Logout revoca. `admin:password` cambia la contraseña y **revoca todas las sesiones**.                                                                                                                      | 2    |
| Fijación de sesión                          | Se genera un token nuevo en cada login y se revoca el anterior.                                                                                                                                                                                                  | 2    |
| CSRF                                        | Token sincronizado por sesión en `X-CSRF-Token` para todo método de escritura, comparado en tiempo constante, más `SameSite=Strict`.                                                                                                                             | 2    |
| Endpoint privado sin protección             | El middleware de sesión se monta a nivel del router `/admin` y no por ruta. Un test recorre todas las rutas registradas y exige 401 sin sesión.                                                                                                                  | 2    |
| Falsificación de IP para evadir límites     | `trust proxy = 1`, la API sin puertos publicados y Caddy que descarta el `X-Forwarded-For` entrante. Lo cubre un test.                                                                                                                                           | 2    |
| Inyección (SQL, payloads malformados)       | Prisma con consultas parametrizadas y Zod en body, query y params. Se rechaza lo que no valida, sin intentar corregirlo.                                                                                                                                         | 1–3  |
| XSS                                         | React escapa por defecto y no se usa `dangerouslySetInnerHTML` con contenido editable. Hay CSP vía `helmet`, y los textos largos se renderizan como texto plano con saltos de línea, no como HTML.                                                               | 1    |
| Links peligrosos cargados en el panel       | Los links de proyectos, trayectoria y perfil solo aceptan `http` y `https`: `javascript:` en un `href` sería un XSS guardado.                                                                                                                                    | 3    |
| Subida de archivos maliciosos               | Lista blanca: PDF para el CV y JPG, PNG o WebP para imágenes. El tipo se detecta por magic bytes, con un límite de 5 MB. Los nombres los genera el sistema, las imágenes se reprocesan con `sharp` (se descarta EXIF) y nada se sirve desde una ruta ejecutable. | 3    |
| Path traversal en archivos                  | Se accede a los archivos por id de la base. La `storageKey` la genera el sistema y nunca se arma una ruta con datos del cliente.                                                                                                                                 | 1    |
| Exposición de borradores                    | Las rutas públicas filtran por `published` o `status`. La previsualización requiere sesión y envía `noindex`. `/files/:id` sirve solo archivos referenciados por contenido publicado.                                                                            | 1–3  |
| Inyección de cabeceras en el email          | El nombre no admite saltos de línea ni caracteres de control, y el email se valida. El visitante va en `Reply-To`; el remitente es siempre la cuenta propia.                                                                                                     | 4    |
| Spam en el contacto                         | Honeypot, límite de 5 por hora por IP, validación de largo y contenido guardado como texto.                                                                                                                                                                      | 4    |
| Inflado de métricas                         | Límite de 60 eventos por minuto por IP en `/public/events`, tipos en lista blanca y largos acotados.                                                                                                                                                             | 4    |
| Privacidad de los visitantes                | Sin cookies de seguimiento, sin IP en crudo y hash diario con sal en memoria (ver [D-016](decisiones.md#d-016-métricas-propias-sin-cookies)).                                                                                                                    | 4    |
| Marca de sesión manipulada                  | La marca del footer no da permisos: solo decide si se consulta `/auth/me`. Falsificarla muestra "Acceso" y la borra. La API valida la sesión en cada request (ver [D-032](decisiones.md#d-032-acceso-al-panel-desde-el-footer)).                                 | 3    |
| Indexación del panel                        | Meta `noindex` y `X-Robots-Tag: noindex` en `/admin` y en la API de admin, fuera del sitemap y con `nofollow` en el link. `robots.txt` no lo bloquea: un buscador bloqueado no podría leer el `noindex`.                                                         | 1–3  |
| Cabeceras y CORS                            | `helmet` (CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'`). CORS restringido al propio origen.                                                                                                                                  | 1    |
| Secretos en el repo                         | `.env` en `.gitignore`, un `.env.example` sin valores reales, variables validadas con Zod al iniciar (si falta una, el arranque falla) y escaneo de secretos en CI.                                                                                              | 1    |
| Errores que filtran información             | Respuesta 500 genérica. El detalle va solo al log, sin contraseñas ni tokens.                                                                                                                                                                                    | 1    |
| Pérdida de datos                            | Backups automáticos de la base (`pg_dump`) y del volumen de archivos a un destino externo, con una restauración probada y documentada.                                                                                                                           | 5    |
| Dependencias vulnerables                    | Lockfile versionado, `npm audit` en CI y actualizaciones revisadas en cada fase.                                                                                                                                                                                 | 1    |

## Flujo del login

`POST /api/v1/auth/login`. El orden de los pasos es parte de la defensa.

| Paso | Qué hace                                                              | Qué protege                                                                          |
| ---- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1    | Límite general por IP (20 intentos cada 15 min)                       | Prueba de muchos usuarios desde una IP y abuso de CPU con Argon2                     |
| 2    | Valida el body con Zod: textos no vacíos y con largo máximo           | Tipos inesperados y contraseñas enormes. Sin mínimo: no revela la política de claves |
| 3    | Consulta el bloqueo por usuario + IP; si está activo, 429             | Fuerza bruta. Va antes de Argon2, y bloquea aunque la clave sea correcta             |
| 4    | Busca al usuario y corre Argon2, contra un hash ficticio si no existe | Enumeración de usuarios por tiempo de respuesta                                      |
| 5    | Si falla, suma el fallo y responde 401 con un único mensaje           | Enumeración por contenido y por comportamiento del bloqueo                           |
| 6    | Si es correcta, limpia los fallos y revoca la cookie previa           | Fijación de sesión                                                                   |
| 7    | Crea un token nuevo y guarda solo su SHA-256                          | Robo de la base: con el hash no se puede usar la sesión                              |

Después del login:

- **Cada request privada:** `requireSession` rechaza con el mismo 401 una sesión inexistente, revocada, vencida (7 días) o inactiva (2 h).
- **Cada escritura:** `requireCsrf` exige `X-CSRF-Token` igual al de la sesión, comparado en tiempo constante.
- **Rutas `/admin`:** la barrera está en el router, así que una ruta nueva nace protegida.
- **`POST /auth/login` no lleva token CSRF:** todavía no hay sesión. Otro sitio no puede enviar el JSON: un formulario no genera ese tipo de contenido, y `fetch` requiere una autorización CORS que la API no da.

### Riesgos aceptados

- **Ataque distribuido:** muchas IP contra un usuario no chocan con el bloqueo por usuario + IP. Lo mitigan la contraseña de 12 caracteres como mínimo y el costo de Argon2.
- **Intentos simultáneos:** varios pueden pasar la consulta del bloqueo antes de que se registre el primer fallo. El contador no pierde ninguno, y el límite por IP acota cuántos son.
- **Límite por IP en memoria:** se reinicia con el proceso y es por instancia. Alcanza porque hay una sola instancia y el bloqueo persistente está en la base.

## IP real del cliente

```
Cliente ──► Caddy (único puerto expuesto) ──► API (red interna de Docker)
            reemplaza X-Forwarded-For         trust proxy = 1 → req.ip = IP agregada por Caddy
```

- **Por qué no se puede falsificar:** la API no se puede alcanzar sin pasar por Caddy, y Express confía en un solo salto. Un `X-Forwarded-For` enviado por el cliente no cambia `req.ip`.
- **Dónde se usa:** `req.ip` alimenta el rate limit, el bloqueo de login y el `visitorHash`. Nunca se persiste en crudo.

## Secretos: respaldo y recuperación

| Secreto                                                     | Dónde vive                                        | Si se pierde                            | Si se filtra                                                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `POSTGRES_PASSWORD`                                         | `.env` del servidor y gestor de contraseñas       | Se puede cambiar con acceso al servidor | Cambiarla en la base y en el `.env`. La base no publica puertos.                                                         |
| Clave privada de `age` (si se activan los backups externos) | **Solo** en el gestor de contraseñas              | **Los backups no se pueden recuperar**  | Generar otra clave y cambiar `BACKUP_AGE_RECIPIENT`. Los backups viejos quedan expuestos: borrarlos del destino externo. |
| `SMTP_PASS`                                                 | `.env` del servidor y gestor de contraseñas       | Crear otra contraseña de aplicación     | Revocarla en la cuenta de Google y crear otra.                                                                           |
| `rclone.conf` (si se activan los backups externos)          | Servidor (permisos `600`) y gestor de contraseñas | Crear otra clave en el proveedor        | Revocarla en el proveedor. Los backups siguen cifrados.                                                                  |
| Token de DuckDNS                                            | Gestor de contraseñas                             | Se ve en la cuenta de DuckDNS           | Regenerarlo en DuckDNS. Permite cambiar la IP del subdominio.                                                            |
| Contraseña del panel                                        | Gestor de contraseñas. En la base, solo su hash   | `admin:password` desde el servidor      | `admin:password`, que además revoca todas las sesiones.                                                                  |

- **Rotación:** cambiar el valor en el `.env` y aplicar con `docker compose up -d`.
- **Recuperación:** hoy depende del [backup semanal de DonWeb](deploy.md#backups), que no está cifrado con una clave propia, guarda todo el disco (incluido el `.env`) y no se probó. Con los backups externos activados, el gestor de contraseñas y una copia alcanzan para reconstruir el servidor desde cero ([procedimiento](deploy.md#restaurar-un-backup-externo)), algo probado en local borrando todos los volúmenes. Ver [D-041](decisiones.md#d-041-backups-externos-opcionales).

## Revisión de seguridad (Fase 5)

Hecha el 5 de noviembre de 2026, sobre el código y las imágenes locales. No reemplaza una auditoría externa ni incluye pruebas contra el servidor real.

| Revisión                              | Resultado                                                                                                                                                                                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secretos en el repo y en su historial | `gitleaks` 8.28.0: 52 commits, sin hallazgos. `docs/spec.md`, `private/` y `.env` nunca se commitearon.                                                                                                                                                                               |
| Dependencias de producción            | `npm audit --omit=dev`: 0 vulnerabilidades.                                                                                                                                                                                                                                           |
| Dependencias de desarrollo            | 8 moderadas en herramientas de lint. No llegan a producción.                                                                                                                                                                                                                          |
| Imágenes Docker (`trivy`)             | **Corregido:** las de severidad alta con parche venían del `npm` de la imagen base, que ya no está en las imágenes. **Aceptado:** quedan 45 altas en paquetes de Debian sin parche publicado, casi todas de `util-linux` y de escalada local. Reconstruir las imágenes las actualiza. |
| Usuarios de los contenedores          | La API y la web corren como `node`, sin privilegios, y con `no-new-privileges`. El servicio de backup corre como root, sin puertos publicados, porque necesita ajustar permisos al restaurar.                                                                                         |
| Puertos publicados                    | Solo Caddy, verificado con el stack de producción.                                                                                                                                                                                                                                    |
| Cabeceras                             | CSP con nonce en la web y `default-src 'none'` en la API, HSTS, `nosniff`, `X-Frame-Options`, sin `Server` ni `X-Powered-By`. Con pruebas end-to-end.                                                                                                                                 |
| XSS                                   | Un script inyectado en el HTML no se ejecuta (prueba end-to-end). Los únicos `dangerouslySetInnerHTML` son dos scripts constantes, con nonce.                                                                                                                                         |
| Links cargados en el panel            | Solo `http` y `https`.                                                                                                                                                                                                                                                                |
| Bomba de descompresión en imágenes    | **Corregido:** `sharp` rechaza más de 40 megapíxeles.                                                                                                                                                                                                                                 |
| Datos en los logs                     | **Corregido:** Prisma con `errorFormat: 'minimal'`. Los errores de email no registran el mensaje ni al remitente. Caddy no guarda logs de acceso, así que no quedan IP.                                                                                                               |
| Autorización                          | Una prueba recorre todas las rutas del panel: sin sesión dan 401, y las escrituras sin CSRF dan 403.                                                                                                                                                                                  |
| Backups                               | Cifrados con clave pública. Un archivo sin cifrar no se genera: el backup falla si falta la clave.                                                                                                                                                                                    |

### Riesgos residuales aceptados

- **Imágenes base por versión, no por digest:** una actualización de la etiqueta puede cambiar lo que se construye. A cambio, reconstruir trae los parches.
- **Un solo servidor:** sin alta disponibilidad. Si se cae, el sitio queda fuera de línea hasta restaurarlo.
- **HSTS con `includeSubDomains`:** obliga a usar HTTPS en cualquier subdominio futuro. No está en la lista de precarga, así que se puede revertir.
- **Sin SMTP o sin destino externo configurados:** el sistema funciona, pero avisa en los logs. Es responsabilidad de la puesta en marcha completarlos.
- **Sin WAF ni protección DDoS:** el límite por IP frena abusos simples, no un ataque distribuido.
