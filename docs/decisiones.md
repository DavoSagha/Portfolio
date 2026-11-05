# Registro de decisiones

Cada decisión indica el contexto, la elección, las alternativas consideradas y el motivo. El estado es _Aceptada_ salvo que se indique lo contrario.

## D-001. Monorepo con npm workspaces

- **Contexto:** hay dos aplicaciones (`apps/api`, `apps/web`) en un solo repo.
- **Decisión:** npm workspaces.
- **Alternativas:** pnpm workspaces, Turborepo, Nx, o dos repos separados.
- **Motivo:** viene con Node y no suma herramientas. Con dos apps, la caché de builds de Turborepo o Nx no compensa su configuración. Dos repos complicarían el CI y la revisión técnica.

## D-002. Un solo origen detrás del proxy inverso

- **Contexto:** la web y la API tienen que compartir la cookie de sesión.
- **Decisión:** Caddy enruta `/api/*` y `/cv*` a la API y todo lo demás a Next, bajo el mismo dominio.
- **Alternativas:** la API en un subdominio (`api.dominio`) con CORS y cookies compartidas, o la API detrás de las rutas de Next.
- **Motivo:**
  - Con el mismo origen, la cookie es first-party y puede ser `SameSite=Strict`.
  - CORS queda cerrado y no hay preflight.
  - Hacer pasar la API por Next sumaría un salto y acoplaría las dos apps.

## D-003. Caddy como proxy inverso

- **Decisión:** Caddy 2.
- **Alternativas:** Nginx + Certbot, Traefik.
- **Motivo:** obtiene y renueva los certificados TLS sin configuración extra, y el `Caddyfile` es corto y legible. Traefik tiene sentido con descubrimiento dinámico de contenedores, algo que acá no hace falta. Sumar demos en subdominios es agregar un bloque.

## D-004. API Express en capas con Zod

- **Decisión:** Express 5 con capas `routes → controllers → services → repositories` y esquemas Zod en cada borde (body, query, params, env).
- **Alternativas:** NestJS, Fastify, o una arquitectura hexagonal completa.
- **Motivo:**
  - Express es el estándar del mercado laboral local y la versión 5 maneja errores `async` de forma nativa.
  - Las capas separan HTTP, reglas y datos sin la "magia" de decoradores de NestJS, que sería más difícil de explicar en una entrevista.
  - Una arquitectura hexagonal completa sería una abstracción sin necesidad concreta.

## D-005. Render en el servidor con caché de datos de 60 segundos

- **Contexto:** buen rendimiento y previews al compartir, y cambios del panel visibles sin redesplegar.
- **Decisión (revisada en la Fase 1):** las páginas se renderizan en el servidor en cada request (`dynamic = 'force-dynamic'`), y las respuestas de la API se cachean 60 s en el caché de datos de Next (`fetch` con `revalidate: 60`).
- **Plan original:** ISR, es decir, HTML pre-generado y revalidado cada 60 s.
- **Por qué cambió:** con ISR, `next build` intenta pre-generar las páginas y necesita la API levantada. En Docker, la imagen de la web se construye antes de que exista la API. Con render por request, el build no depende de la API, y el resultado para el visitante es el mismo:
  - El HTML se genera en el servidor, así que los previews al compartir funcionan.
  - La API recibe como máximo una consulta por endpoint cada 60 s.
  - Los cambios se ven en un minuto o menos.
- **Alternativas descartadas:** generación estática con redeploy (exige redesplegar) y revalidación a demanda desde la API (acopla la API con Next).
- **Revisión:** si la demora molesta, se agrega revalidación a demanda.

## D-006. Panel dentro de la misma app Next

- **Decisión:** `/admin` en `apps/web`, sin lógica de negocio.
- **Alternativas:** una SPA separada (Vite) o un admin autogenerado.
- **Motivo:** una sola app que desplegar y un solo origen. La seguridad no depende de la web: la API verifica sesión y CSRF en cada endpoint privado, y el chequeo de Next solo redirige.

## D-007. PostgreSQL con Prisma 7

- **Decisión:** Prisma 7 con `@prisma/adapter-pg` y migraciones versionadas en el repo.
- **Alternativas:** Drizzle, Knex o SQL a mano.
- **Motivo:** el esquema declarativo funciona como documentación y las migraciones quedan revisables. Prisma 7 elimina el motor binario, lo que simplifica las imágenes de Docker. Drizzle es una alternativa válida, más cerca del SQL; se eligió Prisma por su documentación y su adopción.

## D-008. Internacionalización con tablas de traducción

- **Decisión:** tablas `<Entidad>Translation(entityId, locale, …)` con una clave única por idioma.
- **Alternativas:**
  - Columnas por idioma (`titleEs`, `titleEn`): cada idioma nuevo requiere una migración.
  - Campos JSON por entidad: se pierde integridad y es más difícil validar.
  - Archivos de traducción: no sirven para contenido editable.
- **Motivo:** sumar inglés o francés es insertar filas. Los campos neutros (fechas, URLs, orden) no se duplican.

## D-009. Una sola tabla para la línea de tiempo

- **Decisión:** `TimelineEntry` con `type` = experiencia, educación o certificación.
- **Alternativas:** tres tablas.
- **Motivo:** comparten forma y se muestran juntas ordenadas por fecha. Una tabla significa un CRUD, una consulta y un componente. `relatedProjectId` vincula una certificación con un proyecto sin duplicar texto.

## D-010. CV vigente como puntero

- **Decisión:** `CvProfile.currentVersionId` apunta a la versión vigente, y las versiones se conservan como historial.
- **Alternativas:** un booleano `isCurrent` en cada versión con un índice único parcial.
- **Motivo:** el puntero hace imposible tener dos versiones vigentes por perfil, y cambiar de versión es una sola actualización. `/cv` y `/cv/:profile` son links estables porque resuelven el puntero en cada descarga.

## D-011. Seed que solo crea lo que falta

- **Contexto:** el seed carga el contenido inicial, pero después el contenido se edita desde el panel.
- **Decisión (precisada en la Fase 1):**
  - El seed es "todo o nada": carga el contenido en una transacción **solo si la base no tiene contenido** (ni perfil, ni proyectos, ni skills, ni trayectoria, ni idiomas). Si encuentra algo, no hace nada. **Nunca actualiza ni borra filas.**
  - En desarrollo (`APP_ENV=development`), el contenedor lo ejecuta al arrancar, y es un no-op si ya hay contenido.
  - En producción nunca corre al arrancar: se ejecuta una vez a mano (`docker compose exec api node dist/cli/seed.js`), y también es un no-op si ya hay contenido.
  - El arranque del contenedor siempre ejecuta `prisma migrate deploy`.
- **Por qué no "registro por registro" por clave natural** (plan original): si desde el panel se renombra o borra una skill, un seed por clave natural la volvería a crear. Es decir, duplicaría o resucitaría contenido, que es justamente pisar cambios del panel.
- **Alternativas:** `upsert` con actualización, que pisa cambios del panel.
- **Motivo:** protege los cambios hechos desde el panel. Lo verifican tests que editan, renombran y borran, re-seedean y comprueban que nada vuelve.

## D-012. Sesiones en base de datos

- **Decisión:** token aleatorio de 32 bytes en una cookie `HttpOnly; Secure; SameSite=Strict`. En la base se guarda solo su SHA-256. La sesión vence por inactividad (2 h) y por tiempo absoluto (7 días).
- **Alternativas:** JWT en cookie, `express-session` con su propio store.
- **Motivo:**
  - Un JWT no se puede revocar sin una lista negra, y lo pedido es poder revocar sesiones.
  - Guardar el hash evita que una filtración de la base permita usar las sesiones.
  - La implementación propia es corta y fácil de explicar; `express-session` sumaría una dependencia que no ahorra trabajo.

## D-013. CSRF con token sincronizado

- **Decisión:** un `csrfToken` aleatorio por sesión, entregado en `/auth/login` y `/auth/me`. El panel lo envía en `X-CSRF-Token` en todo método de escritura, y la API lo compara en tiempo constante.
- **Alternativas:** solo `SameSite=Strict`, o _double submit cookie_.
- **Motivo:** `SameSite` es una buena primera barrera pero depende del navegador. El token ligado a la sesión no necesita una segunda cookie y es el patrón recomendado por OWASP.

## D-014. Bloqueo de login por usuario + IP

- **Decisión:** 5 fallos por clave `hash(usuario + IP)` bloquean esa clave 15 min. Hay además un límite general por IP en memoria.
- **Alternativas:** bloqueo por cuenta, o solo por IP.
- **Motivo:**
  - El bloqueo por cuenta permite que un tercero deje al administrador sin acceso a propósito.
  - El bloqueo solo por IP no frena intentos distribuidos contra un usuario.
  - La combinación limita la fuerza bruta sin revelar si el usuario existe: se aplica igual a usuarios inexistentes.

## D-015. IP real detrás de Caddy

- **Decisión:** `app.set('trust proxy', 1)`. La API no publica puertos al host, así que solo es accesible por la red interna de Docker, a través de Caddy.
- **Alternativas:** `trust proxy = true`, o leer `X-Forwarded-For` a mano.
- **Motivo:** `true` confía en cualquier `X-Forwarded-For` enviado por el cliente, lo que permite falsificar la IP y evadir los límites. Con un salto de confianza, Express toma la IP que agrega Caddy. Caddy, sin `trusted_proxies`, descarta el encabezado entrante del cliente. Lo verifica un test.

## D-016. Métricas propias sin cookies

- **Decisión:**
  - Los eventos se guardan en la base con un `visitorHash` diario (`SHA-256(sal diaria en memoria + IP + user-agent)`).
  - El origen se toma de `?ref=`.
  - Las descargas de CV las registra el servidor y el resto de los eventos llega por `sendBeacon`.
  - No se registra nada con sesión de admin.
  - `POST /public/events` tiene límite de solicitudes.
- **Alternativas:** Google Analytics (usa cookies y un tercero), Plausible o Umami (otro servicio que operar).
- **Motivo:** cumple "sin cookies de seguimiento y sin IP en crudo" y queda en el mismo backend. Se aceptan las limitaciones: un reinicio de la API cambia la sal y no se cuentan visitantes únicos entre días.

## D-017. Validación de archivos propia más reprocesado

- **Decisión:**
  - El tipo real se detecta por _magic bytes_ con una función propia: `%PDF-` para PDF, `FF D8 FF` para JPG, `89 50 4E 47` para PNG y `RIFF….WEBP` para WebP.
  - Las imágenes se reprocesan con `sharp`, que reescribe el archivo y descarta EXIF y otros metadatos.
  - Los nombres de archivo se generan con un id propio.
  - Los archivos llegan por `multer` en memoria, con un límite de tamaño.
- **Alternativas:** el paquete `file-type`, o confiar en la extensión o en el `Content-Type`.
- **Motivo:** son cuatro firmas: código corto, testeable y sin dependencias. La extensión y el `Content-Type` los controla el cliente. `sharp` es la única opción práctica para reprocesar imágenes en Node.

## D-018. Almacenamiento detrás de una interfaz

- **Decisión:** la interfaz `StorageService { put, getStream, delete }` y la implementación `LocalDiskStorage` sobre un volumen de Docker.
- **Alternativas:** S3 o compatible desde el inicio.
- **Motivo:** para un VPS, el disco es suficiente y no cuesta nada. La interfaz permite cambiar a un almacenamiento de objetos sin tocar los servicios. Es la única abstracción "a futuro" del proyecto, y la pide el requisito explícito.

## D-019. Email por SMTP con Gmail

- **Decisión:** `nodemailer` con SMTP configurado por variables de entorno (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `CONTACT_TO`). Para empezar se usa Gmail con contraseña de aplicación.
- **Alternativas:** el SDK de un proveedor transaccional (Resend, SendGrid), o SMTP de Brevo.
- **Motivo:** es lo más simple de poner en marcha y se puede cambiar de proveedor sin tocar código.
- **Riesgos aceptados:** Gmail tiene límites de envío y menor entregabilidad. El mensaje se guarda antes de enviarse, así que un fallo del SMTP no lo pierde.

## D-020. Dirección visual B con design tokens

- **Decisión:** dirección "Consola mainframe" en versión sobria (ver [diseño](diseno.md)): monoespaciada solo como acento, sin simular una terminal y con contraste AA verificado. Colores, tipografía, espaciado y radios centralizados en tokens CSS mapeados a `@theme` de Tailwind 4.
- **Alternativa:** dirección A, "Editorial técnico".
- **Motivo:** refuerza el perfil backend y mainframe. Los tokens permiten cambiar el estilo sin reescribir componentes.

## D-021. Previsualización autenticada

- **Decisión:**
  - Los borradores de proyectos se ven en `/admin/preview/projects/:id`, con el mismo componente público y los datos de `GET /admin/projects/:id/preview`.
  - Las versiones anteriores del CV se abren con `GET /admin/cv/versions/:id/file`.
  - Las dos rutas requieren sesión, envían `noindex` y no registran métricas.
- **Alternativa:** publicar y despublicar para revisar.
- **Motivo:** permite revisar antes de publicar sin exponer borradores.

## D-022. Proyectos destacados

- **Decisión:** el campo `Project.featured` (booleano). `/public/home` devuelve los proyectos publicados y destacados, ordenados por `order`.
- **Alternativa:** mostrar los primeros N proyectos.
- **Motivo:** el inicio tiene que mostrar los proyectos más relevantes, que no siempre coinciden con el orden general.

## D-023. Versiones fijadas en la Fase 1

Verificadas con `npm view` (2026-11) y fijadas exactas (`save-exact`), con el lockfile versionado.

| Herramienta        | Versión                          | Nota                                                                                                    |
| ------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Node.js            | 26 LTS (`.nvmrc`, `engines`)     | Node 20 ya no tiene soporte; Vitest 5 exige Node ≥ 22.12                                                |
| Next.js / React    | 16.4.5 / 19.3.1                  |                                                                                                         |
| Express            | 5.3.0                            |                                                                                                         |
| Prisma             | 7.10.1                           | `prisma@latest` apunta a una release candidate de la 8; se usa la última estable                        |
| Zod                | 4.6.7                            |                                                                                                         |
| TypeScript         | 6.0.3                            | La 7.0 existe, pero typescript-eslint soporta hasta la 6.0                                              |
| ESLint             | 9.39.5                           | La 10 existe, pero los plugins de `eslint-config-next` (react, jsx-a11y, import) todavía no la soportan |
| Tailwind CSS       | 4.3.4                            |                                                                                                         |
| Vitest / Supertest | 5.1.0 / 7.3.1                    |                                                                                                         |
| PostgreSQL         | 18 (imagen `postgres:18-alpine`) |                                                                                                         |

- **Motivo:** se elige la versión estable más nueva que es compatible con el resto. Una versión más nueva con peer dependencies inválidas genera fallos difíciles de diagnosticar.
- **npm 11:** bloquea los scripts de instalación de dependencias por defecto. Se aprobaron explícitamente solo los de `prisma`, `@prisma/engines` y `esbuild` (`allowScripts` en `package.json`).

## D-024. Datos pendientes explícitos, no inventados

- **Decisión:**
  - Un dato que falta y es texto se guarda como `TODO: <qué falta>`. La web lo resalta (borde punteado rojo) en vez de ocultarlo.
  - Un dato que falta y es enumerado o URL queda en `null`: `Skill.level`, `Project.team`, `Project.origin`, `demoUrl`, `repoUrl`, `credentialUrl`.
  - `npm run content:todos -w apps/api` lista todo lo pendiente y sale con código 1 si queda algo. Sirve como verificación antes de producción.
  - Las skills sin nivel quedan ocultas (`published = false`), así que la sección Skills no se muestra hasta confirmar niveles.
- **Alternativas:** valores por defecto (por ejemplo, nivel "básico"), que serían inventar datos.
- **Motivo:** el requisito es no inventar nada y que los faltantes sean visibles. Los `TODO` no pueden llegar a producción, y el comando lo verifica.
- **Cambios en el modelo:** `level`, `team` y `origin` pasan a ser opcionales. Se suma `TimelineEntry.datePrecision` (`MONTH | YEAR`) porque algunas fechas, como las certificaciones, se conocen solo por año.

## D-025. CV cargado por consola hasta tener el panel

- **Decisión:** el comando `cv:import` usa el mismo `CvService.importVersion` que usará el panel en la Fase 3. Valida PDF por magic bytes y 5 MB, guarda el hash y marca la versión como vigente salvo con `--no-current`.
- **Motivo:** la Fase 1 tiene que poder usarse sin panel, y reutilizar el servicio evita duplicar reglas.

## D-026. Imágenes servidas sin el optimizador de Next

- **Decisión:** `next/image` con `unoptimized` para las imágenes de `/files/*`.
- **Motivo:** la API va a reprocesar cada imagen al subirla (tamaño y formato, Fase 3), así que optimizarla otra vez en Next duplica trabajo. Además, el optimizador tendría que pedir la imagen a la API desde dentro del contenedor de Next.
