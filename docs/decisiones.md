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

## D-027. Paginación de proyectos solo en celular, como mejora progresiva

- **Contexto:** en celular, una lista larga de tarjetas obliga a hacer mucho scroll. En escritorio, la grilla de dos columnas no lo necesita.
- **Decisión:**
  - **Servidor:** renderiza **todos** los proyectos en el HTML. El componente de cliente `PaginatedProjectList` solo oculta (atributo `hidden`) los que no corresponden a la página, de a 3, y solo en celular (`max-width: 767.98px`, el mismo corte que `md` de Tailwind).
  - **URL:** la página vive en `?pagina=N` y se actualiza con `history.pushState`, que Next sincroniza con `useSearchParams` sin volver a pedir la página al servidor. Funcionan Atrás, Adelante y los links compartidos. Un valor inválido (`0`, `-1`, `1.5`, `abc`, mayor que el total) muestra la página 1.
  - **Escritorio:** se ven todos y la URL no cambia, así que al volver a celular se conserva la página.
  - **Cambio de página:** la vista va al inicio de la lista (`scrollIntoView`, sin animación si `prefers-reduced-motion: reduce`) y el foco pasa a la lista (`tabIndex=-1`).
  - **Accesibilidad:** `<nav aria-label="Paginación de proyectos">`, botones con `aria-current="page"`, "Anterior" y "Siguiente" deshabilitados en los extremos, indicador "Página X de Y" con `aria-live="polite"` y objetivos táctiles de 44 px.
  - **Sin paginación** con 3 proyectos o menos, en escritorio, en el inicio (que muestra solo los destacados) y sin JavaScript.
- **Alternativas:**
  - **Paginación en el servidor** (`?pagina=2` devuelve solo 3 proyectos): los demás links no estarían en el HTML, y en escritorio habría que paginar o pedir todo de nuevo.
  - **"Cargar más" o scroll infinito:** sin URL por estado, y peor para teclado y lectores de pantalla.
  - **Carrusel o swipe:** descartado por el diseño (sin carruseles) y por accesibilidad.
  - **Una librería de paginación:** son menos de 150 líneas y sin dependencias.
- **Motivo:** SEO y robustez (todo está en el HTML), estado compartible en la URL y accesibilidad completa, sin dependencias nuevas.
- **Pruebas:** `e2e/projects-pagination.spec.ts` (Playwright, viewport de 390 × 844) cubre el cambio de página, la URL, Atrás y Adelante, páginas inválidas, el uso con teclado, el foco, el paso a escritorio, el funcionamiento sin JavaScript y el inicio sin paginación.

## D-028. Foto de perfil por consola, reprocesada

- **Decisión:** `photo:import` usa `ImageService`, el mismo que usará el panel. Valida el tipo real (JPG, PNG o WebP) y un máximo de 5 MB, y reprocesa la imagen con `sharp`:
  - aplica la orientación EXIF;
  - limita el lado mayor a 1600 px;
  - la guarda como WebP **sin ningún metadato** (EXIF, GPS, XMP, ICC).

  Una imagen con firma válida pero que no se puede decodificar se rechaza con 415.

- **Motivo:** el requisito de eliminar metadatos se cumple desde la primera foto, no recién con el panel. `sharp` ya estaba prevista en D-017.

## D-029. Stack, estado y secciones vacías de los proyectos

- **Contexto:** el stack de cada proyecto incluye herramientas que no son skills del perfil (Vite, Vitest, Tailwind, la API de Gemini). Además, un proyecto puede estar en desarrollo, y no todos tienen textos para todas las secciones del detalle.
- **Decisión:**
  - `Project.stack` (lista de texto, en orden) es lo que se muestra como "Tecnologías". La relación `ProjectSkill` se mantiene para vincular skills del perfil con proyectos ("Usada en …").
  - `Project.inProgress` (booleano) agrega la etiqueta "En desarrollo".
  - Un texto vacío no se muestra, y la API lo devuelve como `null`. Aplica al aporte propio (`role`), al aviso y a las secciones del detalle. Reemplaza al marcador `TODO:` para las secciones del detalle: ya no se consideran pendientes, solo no se muestran.
  - Los datos confirmados por el titular reemplazan a los del documento de requisitos cuando difieren.
- **Alternativas:**
  - Derivar el stack de `ProjectSkill`: obligaría a crear skills para herramientas que no se quieren mostrar como skills.
  - Un enumerado de estado (en desarrollo, terminado, pausado): no hace falta por ahora; un booleano alcanza y se puede ampliar.
- **Motivo:** mostrar solo contenido real, sin inventar textos para completar secciones.

## D-030. Detalles de la autenticación

- **Decisión:**
  - **Nombres de usuario:** se normalizan (minúsculas, sin espacios) al crear, al buscar y en la clave de bloqueo. Cambiar mayúsculas no reinicia el contador de fallos.
  - **Largo de la contraseña:** de 12 a 1024 caracteres al crearla. El login solo aplica el máximo: un mínimo daría 400 en vez de 401, revelaría la política y no sumaría fallos.
  - **Conteo de fallos:** se suma con una sola sentencia SQL (`INSERT … ON CONFLICT`), para no perder fallos entre intentos simultáneos.
  - **Límite por IP:** 20 intentos de login cada 15 minutos, con `express-rate-limit`, en memoria.
  - **Actividad de la sesión:** `lastSeenAt` se actualiza como máximo una vez por minuto, para no escribir en la base en cada request.
  - **Limpieza:** cada hora se borran las sesiones y los bloqueos vencidos hace más de un día.
  - **Script de instalación de `argon2`:** bloqueado en `allowScripts`. El paquete trae binarios precompilados y no hace falta compilar.
  - **Rutas de `/admin`:** todavía no hay recursos. Las barreras se prueban sobre el router, y la Fase 3 agrega los recursos detrás de ellas.
- **Alternativas:**
  - Un contador en dos pasos (leer y escribir): dos intentos simultáneos contarían como uno.
  - Compilar `argon2` en la imagen: suma herramientas de compilación y un script de instalación sin ganar nada.
  - Guardar el límite por IP en la base: una escritura más por intento, cuando el bloqueo persistente ya está ahí.
- **Motivo:** cada punto cierra un caso concreto de evasión o de crecimiento sin límite, con el menor código posible.

## D-031. Panel de administración

- **Decisión:**
  - **Datos:** las páginas del panel son componentes de servidor que leen la API reenviando la cookie, sin caché. Los formularios son componentes de cliente que solo envían a la API y muestran sus errores.
  - **Errores:** la API devuelve la ruta de cada campo inválido, y el formulario lo marca con `aria-invalid` y muestra su nombre visible.
  - **Orden:** botones de subir y bajar, sin arrastrar: funcionan con teclado y en celular, sin dependencias.
  - **Idioma:** el panel edita el español. La API ya acepta otros idiomas, y su edición se suma cuando haya contenido traducido.
  - **Trayectoria:** el sitio la ordena por `order`, y ya no por fecha, para que el orden del panel tenga efecto. Una migración conservó el orden visible, y el botón "Ordenar por fecha" lo recalcula. Una entrada nueva va al final.
  - **Archivos privados:** `GET /admin/files/:id` sirve las imágenes de borradores con sesión. `/files/:id` sigue sirviendo solo lo publicado.
  - **Limpieza:** reemplazar o borrar una foto, portada, imagen, proyecto o versión de CV borra su archivo de la base y del disco.
  - **Pruebas end-to-end:** corren en un stack aparte (`portfolio-e2e`, puerto 8081), con su propia base y un administrador de prueba, porque editan contenido.
- **Alternativas:**
  - Formularios con estado por campo o una librería de formularios: `FormData` alcanza y no suma dependencias.
  - Arrastrar y soltar: suma una dependencia y requiere una alternativa accesible de todos modos.
  - Mantener la trayectoria ordenada por fecha: el campo `order` solo desempataría, y el orden pedido no tendría efecto visible.
  - Correr las pruebas contra el stack de desarrollo: modificarían el contenido real y necesitarían la contraseña real.
- **Motivo:** el panel es una capa fina sobre la API, y la seguridad y las reglas viven en un solo lugar.

## D-032. Acceso al panel desde el footer

- **Decisión:**
  - **HTML público:** el servidor renderiza siempre "Acceso", sin leer la sesión. Funciona sin JavaScript y una caché nunca puede guardar el estado de una sesión.
  - **Marca:** `localStorage` guarda `panel-session-hint` al iniciar sesión o al entrar al panel. No es secreta ni da permisos: solo indica que vale la pena consultar `/auth/me`.
  - **Resolución en el cliente:** sin marca no se consulta nada. Con marca, una consulta a `/auth/me` por carga de página decide qué mostrar. La cookie `HttpOnly` nunca se lee.
  - **Sesión vencida (401):** vuelve "Acceso" y se borra la marca. Con un error de red se muestra "Acceso" y se conserva la marca, porque no se sabe si venció.
  - **Sin saltos:** un script previo al pintado oculta "Acceso" con `visibility: hidden`, que conserva su lugar. El footer tiene un alto fijo, y en celular usa dos filas.
  - **Cerrar sesión:** envía el token CSRF, revoca la sesión en la base y borra la marca.
  - **Sin precarga:** los links usan `prefetch={false}`. Si no, Next pediría `/admin` en cada visita y el servidor consultaría la sesión.
  - **Indexación:** `/admin` no está en `sitemap.xml` y mantiene `noindex` ([D-033](#d-033-admin-sin-bloqueo-en-robotstxt)). El link lleva `rel="nofollow"`.
  - **Dentro del panel:** el footer no muestra accesos ni consulta `/auth/me`: queda la navegación lateral.
  - **Métricas (Fase 4):** la exclusión de las visitas propias depende de una sesión válida en el backend, nunca de la marca. Una marca falsa no excluye a nadie, y una sesión vencida vuelve a contar.
- **Alternativas:**
  - Leer la sesión en el servidor: el HTML público variaría por usuario y no se podría cachear.
  - Consultar `/auth/me` en todas las visitas: una request inútil por cada visitante.
  - Una cookie legible como marca: viajaría al servidor en cada request, sin ningún uso allí.
- **Efecto aceptado:** `/auth/me` renueva la inactividad, así que navegar el sitio público con sesión la mantiene viva. El límite absoluto de 7 días no cambia.
- **Motivo:** el acceso es cómodo sin exponer nada ni penalizar a los visitantes, y la seguridad sigue dependiendo solo del backend.

## D-033. `/admin` sin bloqueo en `robots.txt`

- **Decisión:** `robots.txt` bloquea solo `/api/`. `/admin` mantiene la meta `noindex`, `X-Robots-Tag`, `rel="nofollow"` en el link del footer y su exclusión del sitemap.
- **Alternativa:** mantener `Disallow: /admin`. Un buscador bloqueado nunca lee el `noindex`, y como cada página pública enlaza al panel, podría listar la URL sin contenido.
- **Motivo:** el `noindex` solo funciona si se puede leer. El panel sigue protegido por sesión, y su URL ya es visible en el footer.

## D-034. Contacto y métricas

- **Decisión:**
  - **Envío del email:** después de responder, sin que la persona espere al proveedor. El mensaje ya está guardado, y el panel muestra si se envió, si falló y por qué.
  - **Sin SMTP configurado:** la API arranca y avisa en el log; los mensajes se guardan. Las variables son todo o nada, para no fallar recién con el primer mensaje.
  - **Remitente:** siempre la cuenta propia, con el visitante en `Reply-To`. Usar su email como remitente haría que el proveedor rechace el envío.
  - **Exclusión del admin:** el backend valida la sesión contra la base en cada evento, sin renovar su inactividad. No usa la marca del footer ([D-032](#d-032-acceso-al-panel-desde-el-footer)).
  - **Origen:** `?ref=` se guarda en `sessionStorage` y dura lo que la pestaña. Se aplica a las páginas siguientes y se agrega al link del CV al hacer clic.
  - **Rutas:** solo la ruta, sin query string, para no guardar datos personales de una URL. Las rutas bajo `/admin` y `/api` no se registran.
  - **Clics a proyectos:** un listener único y atributos `data-project-click`, así las tarjetas siguen siendo componentes de servidor. Los proyectos inexistentes no llegan al panel.
  - **Gráfico:** una serie de barras con tabla alternativa. El color de las barras es un token propio, `--color-chart`, validado para cada tema.
- **Alternativas:**
  - Esperar el envío antes de responder: la persona esperaría al proveedor, y sabría si falló un servicio interno.
  - Una cookie para el origen: el requisito es no usar cookies de seguimiento.
  - Una librería de gráficos: para una sola serie alcanza con HTML y CSS.
- **Limitaciones aceptadas:**
  - **Links externos a tu CV:** al abrir `/cv` desde otro sitio (por ejemplo, LinkedIn), el navegador no envía la cookie `SameSite=Strict`, así que esa descarga cuenta aunque tengas sesión. Dentro del sitio sí se excluye.
  - **Envíos interrumpidos:** si la API se reinicia en plena entrega, el mensaje queda guardado con el envío pendiente, sin reintento.
  - **Límite de eventos:** es por IP, así que una red compartida puede perder eventos si supera los 60 por minuto.
  - **Bots:** los que ejecutan JavaScript se cuentan como visitas.
- **Motivo:** cumple "sin cookies de seguimiento y sin IP en crudo", y una falla de email o de métricas nunca afecta a quien visita el sitio.

## D-035. Retención de datos

- **Decisión:** los eventos de métricas se borran a los 12 meses, con la tarea periódica de la API. Los mensajes de contacto se conservan hasta que el administrador los borre.
- **Alternativas:** borrar los eventos por `cron` en el servidor, o agregarlos antes de borrarlos.
- **Motivo:** los eventos pierden utilidad con el tiempo y no hace falta guardarlos indefinidamente. La tarea ya existía para las sesiones, así que no suma infraestructura. Un backup puede conservar eventos por encima de los 12 meses hasta que rote: 90 días como máximo.

## D-036. CSP de la web con nonce

- **Decisión:** `proxy.ts` genera un nonce en cada request y arma la CSP. `script-src` usa el nonce y `strict-dynamic`, sin `unsafe-inline`. `style-src` mantiene `unsafe-inline`, para los estilos en línea.
- **Alternativas:** una CSP por hash, que no sirve para los scripts que Next genera en cada render, o `unsafe-inline`, que anula la protección.
- **Motivo:** un XSS no puede ejecutar scripts aunque llegue al HTML. No tiene costo de caché, porque las páginas ya se renderizan en cada request (D-005). Un estilo en línea no ejecuta código, y evitarlo obligaría a reescribir el gráfico.

## D-037. Backups cifrados con clave pública

- **Decisión:**
  - Un servicio de Docker hace un `pg_dump` y empaqueta los archivos, con sumas de verificación, en un solo archivo cifrado con `age`. Corre por `cron` y copia al destino externo con `rclone`.
  - El servidor tiene solo la clave pública. La privada vive en el gestor de contraseñas.
  - La restauración verifica clave, sumas y dump antes de tocar nada, pide confirmación y aplica la base en una sola transacción.
  - `npm run test:restore` prueba el ciclo completo con la configuración de producción: borra todos los volúmenes, restaura y compara.
- **Alternativas:** los backups del proveedor del VPS, que no están fuera de su cuenta ni permiten restaurar solo la aplicación, o cifrar con una clave simétrica, que tendría que estar en el servidor.
- **Motivo:** los backups tienen mensajes de terceros y el hash de la contraseña. Con clave pública, comprometer el servidor no expone las copias anteriores. Y un backup sin restauración probada no es un backup.
- **Limitación:** el cifrado de la base es solo del backup: en el servidor, los datos están sin cifrar.

## D-038. Imágenes sin npm

- **Decisión:** las imágenes de ejecución eliminan `npm` y `npx`. La API aplica las migraciones llamando directamente a la CLI de Prisma.
- **Motivo:** no se usan en ejecución. Quitarlos eliminó todas las vulnerabilidades de severidad alta con parche que encontró `trivy`, y deja menos herramientas a mano si alguien entra al contenedor.
