# Seguridad

> Estado: las medidas de las Fases 1 y 2 están implementadas y cubiertas por pruebas. Las demás están **previstas**. La Fase 5 incluye una revisión completa.

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
| Subida de archivos maliciosos               | Lista blanca: PDF para el CV y JPG, PNG o WebP para imágenes. El tipo se detecta por magic bytes, con un límite de 5 MB. Los nombres los genera el sistema, las imágenes se reprocesan con `sharp` (se descarta EXIF) y nada se sirve desde una ruta ejecutable. | 3    |
| Path traversal en archivos                  | Se accede a los archivos por id de la base. La `storageKey` la genera el sistema y nunca se arma una ruta con datos del cliente.                                                                                                                                 | 1    |
| Exposición de borradores                    | Las rutas públicas filtran por `published` o `status`. La previsualización requiere sesión y envía `noindex`. `/files/:id` sirve solo archivos referenciados por contenido publicado.                                                                            | 1–3  |
| Spam en el contacto                         | Honeypot, límite de 5 por hora por IP, validación de largo y contenido guardado como texto.                                                                                                                                                                      | 4    |
| Inflado de métricas                         | Límite de 60 eventos por minuto por IP en `/public/events`, tipos en lista blanca y largos acotados.                                                                                                                                                             | 4    |
| Privacidad de los visitantes                | Sin cookies de seguimiento, sin IP en crudo y hash diario con sal en memoria (ver [D-016](decisiones.md#d-016-métricas-propias-sin-cookies)).                                                                                                                    | 4    |
| Indexación del panel                        | `robots.txt` lo excluye, junto con la meta `noindex` y `X-Robots-Tag: noindex` en `/admin` y en la API de admin.                                                                                                                                                 | 1–3  |
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

Se completa en la Fase 5. Lineamientos:

- **Cuáles son:** `DATABASE_URL` / `POSTGRES_PASSWORD`, credenciales SMTP y credenciales del destino de backups.
- **Dónde viven:** solo en el `.env` del servidor (permisos `600`) y en un gestor de contraseñas personal como copia de respaldo.
- **Rotación:** cambiar el valor en el `.env` y reiniciar el servicio. La contraseña del admin se cambia con `admin:password`, que revoca las sesiones.
- **Recuperación:** con el gestor de contraseñas y el backup externo alcanza para reconstruir el servidor desde cero. El procedimiento se prueba en la Fase 5.
