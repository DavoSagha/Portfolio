# Plan del proyecto

Portfolio profesional con sitio público y panel de administración privado.

- **Sitio público:** muestra perfil, proyectos, experiencia, skills, idiomas y contacto, y permite descargar el CV vigente con un clic.
- **Panel:** permite editar todo el contenido sin tocar código ni redesplegar.

Documentos relacionados: [modelo de datos](modelo-datos.md) · [API](api.md) · [diseño](diseno.md) · [decisiones](decisiones.md) · [seguridad](seguridad.md) · [pendientes](pendientes.md).

## Arquitectura

```
                    Internet
                       │  HTTPS (443)
                ┌──────▼──────┐
                │    Caddy    │  TLS automático, cabeceras, único puerto expuesto
                └──┬───────┬──┘
     /api/*, /cv*  │       │  todo lo demás
            ┌──────▼──┐ ┌──▼──────────┐
            │   API   │ │     Web     │
            │ Express │ │   Next.js   │──── lee la API por la red interna
            └──┬───┬──┘ └─────────────┘
               │   │
       ┌───────▼┐ ┌▼───────────────┐
       │Postgres│ │ Volumen uploads │
       └────────┘ └─────────────────┘
```

- **Monorepo con npm workspaces**: `apps/api`, `apps/web` y `packages/` (vacío por ahora; se usa solo si aparece código compartido real).
- **Mismo origen.** Caddy enruta `/api/*` y `/cv*` a la API y el resto a Next. Las cookies son first-party y CORS queda cerrado al propio origen.
- **API.** Node.js + TypeScript + Express 5, organizada en capas:
  - `routes`: definen la URL y los middlewares.
  - `controllers`: traducen HTTP a llamadas al servicio.
  - `services`: tienen las reglas de negocio.
  - `repositories`: hacen el acceso a datos con Prisma.

  Zod valida todas las entradas, y las variables de entorno se validan al iniciar.

- **Web.** Next.js (App Router) + TypeScript + Tailwind:
  - Las páginas públicas se renderizan en el servidor en cada request, con los datos de la API cacheados 60 s ([D-005](decisiones.md#d-005-render-en-el-servidor-con-caché-de-datos-de-60-segundos)).
  - El panel `/admin` está en la misma app. Solo tiene formularios y vistas, sin lógica de negocio: toda regla vive en la API.
- **Base de datos.** PostgreSQL con Prisma y migraciones versionadas.
- **Archivos.** Interfaz `StorageService` con una primera implementación en disco (volumen persistente de Docker).
- **Infraestructura.** Docker Compose (`caddy`, `web`, `api`, `db`) en un VPS. Se pueden sumar demos de proyectos en subdominios agregando un bloque en el `Caddyfile`.

### Versiones de referencia

Fecha de verificación: 2026-11.

| Herramienta  | Línea estable                             |
| ------------ | ----------------------------------------- |
| Node.js      | 26 LTS                                    |
| Next.js      | 16.x                                      |
| Express      | 5.x                                       |
| Prisma       | 7.x (driver adapter + `prisma.config.ts`) |
| Zod          | 4.x                                       |
| Tailwind CSS | 4.x                                       |
| Vitest       | 5.x                                       |
| PostgreSQL   | 18                                        |

Las versiones exactas se fijan con `npm view <paquete> version` al iniciar la Fase 1 y quedan en `package-lock.json`.

## Fases

Cada fase tiene su propia rama (`fase-N`), commits pequeños y una revisión con aprobación antes de pasar a la siguiente.

### Fase 0: plan y diseño

Documentación: plan, modelo de datos, contratos de API, dos direcciones visuales, decisiones, pendientes y un borrador de seguridad. Sin código de producto.

### Fase 1: versión pública mínima

- Monorepo, ESLint, Prettier, TypeScript estricto.
- Esquema de Prisma, primera migración y seed idempotente (ver [decisiones](decisiones.md#d-011-seed-que-solo-crea-lo-que-falta)).
- API de lectura pública, `/cv` y `/cv/:profile`, y `GET /files/:id`.
- Sitio público completo con los design tokens de la dirección B, metadatos, Open Graph, `sitemap.xml` y `robots.txt`.
- Docker Compose y CI en GitHub Actions (lint, typecheck, tests y build).

**Aceptación:** `docker compose up` levanta el sitio con el contenido del seed, y la descarga del CV funciona si hay un PDF cargado. Mientras no exista el panel, el PDF se carga con el comando `cv:import`. El CI queda en verde.

### Fase 2: autenticación

- `admin:create` y `admin:password`, ambos interactivos y sin eco. El segundo revoca todas las sesiones.
- Login, logout, sesiones en base, CSRF, bloqueo temporal, protección de rutas y `trust proxy`.
- Pruebas de seguridad (ver [pruebas mínimas](#pruebas-mínimas)).

**Aceptación:** todos los endpoints `/api/v1/admin/*` responden 401 sin sesión y 403 sin token CSRF en métodos de escritura. Las pruebas de login, bloqueo, logout y expiración están en verde.

### Fase 3: panel

- CRUD de todas las secciones, con orden, publicación y borradores.
- Subida de imágenes y CV con validación de tipo real, versiones de CV, CV principal y previsualización de borradores y versiones anteriores.
- **Proyectos y trayectoria editables por completo, sin tocar código.** El panel permite editar todos los campos públicos:
  - **Proyectos:** título, resumen, aporte, secciones del detalle, stack, link de demo, link de repo, estado ("En desarrollo"), equipo, origen, aviso, orden, destacado y publicación.
  - **Trayectoria:** tipo, título, organización, descripción, fechas y su precisión, link de la credencial, proyecto relacionado, orden y publicación.
- **Links vacíos:** un link de demo, repo o credencial vacío no se muestra. Un texto vacío tampoco: la sección no aparece.
- **Aviso de la demo:** campo opcional por proyecto (`demoNote`, traducible) para aclarar que la demo puede tardar en cargar por estar en un hosting gratuito. Se muestra junto al link de la demo, y solo si hay demo.

**Aceptación:**

- El contenido, la foto y el CV se pueden cambiar desde el panel y se ven en el sitio público en 60 s o menos.
- Una demo se puede cargar, cambiar o quitar desde el panel, con su aviso, sin cambios de código.
- Las pruebas de la Fase 3 de la tabla [Pruebas mínimas](#pruebas-mínimas) quedan en verde.

### Fase 4: contacto y métricas

- Formulario con validación, honeypot y límite de envíos. Cada mensaje se guarda en la base y se envía por SMTP.
- Registro de eventos con `?ref=`, exclusión de las visitas con sesión de admin y panel de métricas.

**Aceptación:**

- Un mensaje enviado queda guardado y llega por email.
- Un fallo del SMTP no pierde el mensaje.
- Las métricas no registran visitas ni descargas con sesión de admin.

### Fase 5: producción

- VPS, dominio, HTTPS, backups automáticos de la base y de los archivos a un destino externo, y monitoreo básico (uptime y logs).
- Restauración probada y documentada, revisión de seguridad y auditoría Lighthouse (mobile, 90 o más en las cuatro categorías).

**Aceptación:** restauración completa desde backup en un entorno limpio, documentada paso a paso.

### Fase 6: preparación para entrevistas

`docs/defensa-tecnica.md`, basado solo en lo implementado. Incluye:

- Arquitectura, y los flujos de login y de subida de archivos.
- Modelo de datos, decisiones y limitaciones.
- 20 preguntas probables con sus respuestas.

## Pruebas mínimas

| Prueba                                                                              | Tipo                      | Fase |
| ----------------------------------------------------------------------------------- | ------------------------- | ---- |
| Seed no sobrescribe cambios existentes                                              | Integración (Vitest + DB) | 1    |
| `/cv/:profile` descarga la versión vigente con nombre correcto; 404 sin versión     | Supertest                 | 1    |
| Login correcto e incorrecto, mismo error con usuario inexistente                    | Supertest                 | 2    |
| Bloqueo tras N intentos fallidos y desbloqueo al vencer                             | Supertest                 | 2    |
| Logout y expiración (inactividad y absoluta)                                        | Supertest                 | 2    |
| `admin:password` revoca todas las sesiones                                          | Integración               | 2    |
| 401 en **todos** los endpoints privados sin sesión (recorre el router)              | Supertest                 | 2    |
| 403 sin token CSRF en métodos de escritura                                          | Supertest                 | 2    |
| `X-Forwarded-For` falsificado no cambia la IP usada por el rate limit               | Supertest                 | 2    |
| Validación Zod: 400 con detalle ante datos inválidos                                | Supertest                 | 3    |
| Rechazo de archivos inválidos (extensión falsa, tamaño excedido, tipo no permitido) | Supertest                 | 3    |
| Reemplazo del CV y descarga de la nueva versión vigente                             | Supertest                 | 3    |
| Editar una skill en el panel y verla en el sitio público                            | Playwright                | 3    |
| Editar todos los campos públicos de un proyecto y de la trayectoria                 | Supertest                 | 3    |
| Cargar una demo con su aviso, verla en el sitio, vaciarla y que el link desaparezca | Playwright                | 3    |
| Un link vacío (demo, repo, credencial) o una sección vacía no se muestran           | Supertest + Playwright    | 3    |
| Honeypot y límite de envíos del contacto                                            | Supertest                 | 4    |
| Eventos y descargas con sesión de admin no se registran                             | Supertest                 | 4    |

## Riesgos y mitigaciones

| Riesgo                                        | Mitigación                                                                                                                                     |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Proyecto personal que nombra a un restaurante | Nombre solo en texto, sin logo ni imágenes oficiales. Aviso de "proyecto personal sin afiliación" visible en la tarjeta, el detalle y la demo. |
| Bloqueo del login provocado por un tercero    | Clave de bloqueo por usuario + IP, bloqueo corto (15 min) y límite adicional por IP.                                                           |
| Demora en ver cambios del panel en el sitio   | Caché de datos de 60 s, explicado como compromiso entre rendimiento y frescura.                                                                |
| Límites de envío de Gmail                     | SMTP configurable por variables de entorno; el mensaje siempre se guarda primero en la base.                                                   |
| Pérdida de datos del VPS                      | Backups automáticos a un destino externo y restauración probada (Fase 5).                                                                      |
| Versiones de dependencias desactualizadas     | Versiones fijadas en el lockfile y revisión de actualizaciones en cada fase.                                                                   |

## Cobertura de requisitos

| Requisito                                                                    | Dónde se cubre                                                                    |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Perfil, CTA, links sociales                                                  | [api.md](api.md#público) `GET /public/home` · [diseno.md](diseno.md)              |
| Proyectos con tarjeta y detalle, tipo individual/grupal y académico/personal | [modelo-datos.md](modelo-datos.md#project)                                        |
| Línea de tiempo de experiencia, educación y certificaciones                  | [modelo-datos.md](modelo-datos.md#timelineentry)                                  |
| Skills por categoría con nivel, sin barras                                   | [modelo-datos.md](modelo-datos.md#skillcategory-y-skill) · [diseno.md](diseno.md) |
| Idiomas y contacto (honeypot, límite, email configurable)                    | [api.md](api.md#público) · [modelo-datos.md](modelo-datos.md#profile)             |
| Mobile first, accesibilidad, SEO, Lighthouse ≥ 90                            | [diseno.md](diseno.md) · Fase 5                                                   |
| Secciones vacías no se muestran                                              | [api.md](api.md#público) (`sections` en `/public/home`)                           |
| Panel: CRUD, orden, publicación, borradores, imágenes                        | [api.md](api.md#admin)                                                            |
| CV por perfil con historial y links estables                                 | [modelo-datos.md](modelo-datos.md#cvprofile-y-cvversion) · [api.md](api.md#cv)    |
| Mensajes y métricas                                                          | [api.md](api.md#admin) · [modelo-datos.md](modelo-datos.md#event)                 |
| Seguridad (Argon2id, sesiones, CSRF, bloqueo, subidas, secretos, backups)    | [seguridad.md](seguridad.md)                                                      |
| Métricas sin cookies de seguimiento ni IP en crudo                           | [modelo-datos.md](modelo-datos.md#event) · [decisiones.md](decisiones.md)         |
| Arquitectura preparada para inglés y francés                                 | [modelo-datos.md](modelo-datos.md#internacionalización)                           |
| Seed idempotente sin datos personales sensibles                              | [decisiones.md](decisiones.md#d-011-seed-que-solo-crea-lo-que-falta)              |
| README con instalación de un comando                                         | Fase 1                                                                            |
