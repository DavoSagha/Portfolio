# Contratos de API

Base: `/api/v1`. JSON en UTF-8. Las rutas `/cv*` y `/files/*` están fuera del prefijo porque son links públicos estables.

## Convenciones

**Errores** (mismo formato en toda la API):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Datos inválidos",
    "details": [{ "path": "email", "message": "Email inválido" }]
  }
}
```

| Status | `code`                  | Cuándo                                                          |
| ------ | ----------------------- | --------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`      | falla de Zod en body, query o params                            |
| 401    | `UNAUTHENTICATED`       | sin sesión válida, o credenciales incorrectas                   |
| 403    | `CSRF_INVALID`          | falta el token CSRF o no coincide                               |
| 404    | `NOT_FOUND`             | recurso inexistente o no publicado                              |
| 409    | `CONFLICT`              | slug duplicado, borrar el CV vigente, crear un segundo admin    |
| 413    | `FILE_TOO_LARGE`        | archivo mayor al límite                                         |
| 415    | `UNSUPPORTED_FILE_TYPE` | el tipo real del archivo no está permitido                      |
| 429    | `RATE_LIMITED`          | límite de solicitudes o bloqueo de login; incluye `Retry-After` |
| 500    | `INTERNAL_ERROR`        | mensaje genérico; el detalle va solo al log                     |

**Otras convenciones:**

- **Idioma:** `?locale=es|en|fr`. Si no se indica o falta la traducción, se usa `es`.
- **Fechas:** ISO 8601. Las de calendario van como `YYYY-MM-DD`.
- **Listas:** las secciones públicas son chicas y se devuelven completas, sin paginar. Mensajes y métricas usan `?limit=&cursor=`.
- **IP del cliente:** la API corre con `trust proxy = 1` detrás de Caddy (ver [seguridad](seguridad.md#ip-real-del-cliente)).

## Público

### `GET /health`

`200 { "status": "ok" }` si la API responde y la base está accesible. Lo usa el healthcheck de Docker.

Solo devuelve contenido publicado. No requiere sesión.

### `GET /public/home`

```json
{
  "locale": "es",
  "availableLocales": ["es"],
  "profile": {
    "fullName": "…",
    "headline": "…",
    "valueProp": "…",
    "summary": "…",
    "location": "CABA, Argentina",
    "availability": "…",
    "photoUrl": "/files/ckx…",
    "linkedinUrl": "…",
    "githubUrl": "…",
    "publicEmail": null
  },
  "cv": { "primaryUrl": "/cv", "profiles": ["backend", "mainframe"] },
  "featuredProjects": [/* ProjectCard[] */],
  "sections": {
    "projects": true,
    "timeline": true,
    "skills": true,
    "languages": true,
    "contact": true
  }
}
```

- `publicEmail` es `null` si `showEmail = false`.
- `cv.profiles` lista solo los perfiles con versión vigente. Si no hay CV principal, `cv.primaryUrl` es `null` y la web oculta el botón.
- `sections.*` es `false` cuando la sección no tiene contenido publicado, y entonces la web no la muestra.
- Si el perfil todavía no fue cargado, responde 404 y la web muestra "Sitio en preparación".
- `featuredProjects`: proyectos con `status = PUBLISHED` y `featured = true`, ordenados por `order`.

### `GET /public/projects`

Devuelve `ProjectCard[]` ordenados por `order`:

```json
{
  "slug": "appfut",
  "title": "…",
  "summary": "…",
  "role": "…",
  "inProgress": true,
  "stack": ["Next.js 16", "React 19", "TypeScript"],
  "team": "GROUP",
  "origin": "PERSONAL",
  "featured": true,
  "skills": [{ "name": "TypeScript" }],
  "demoUrl": null,
  "repoUrl": null,
  "coverUrl": null,
  "disclaimer": null
}
```

- `team` y `origin` pueden ser `null` mientras el dato esté pendiente.
- `role`, `disclaimer` y las secciones del detalle vuelven en `null` si están vacías.
- `stack` es la lista de tecnologías que muestra la tarjeta. `skills` son las skills publicadas del perfil vinculadas al proyecto (las usa la sección de skills).

### `GET /public/projects/:slug`

Devuelve `ProjectDetail`: es `ProjectCard` más `context`, `problem`, `solution`, `architecture`, `decisions`, `challenges`, `learnings`, `limitations`, `startDate`, `endDate` y `images: [{ url, alt }]`. Responde 404 si no existe o es borrador.

### `GET /public/timeline`

```json
[
  {
    "type": "EXPERIENCE",
    "title": "…",
    "organization": "…",
    "startDate": "2026-03-01",
    "endDate": null,
    "datePrecision": "MONTH",
    "description": "…",
    "credentialUrl": null,
    "relatedProjectSlug": null
  }
]
```

### `GET /public/skills`

```json
[
  {
    "category": "Backend",
    "skills": [
      { "name": "Node.js", "level": "INTERMEDIATE", "projects": [{ "slug": "…", "title": "…" }] }
    ]
  }
]
```

### `GET /public/languages`

`[{ "code": "fr", "name": "Francés", "level": "B2" }]`

### `POST /public/contact`

Body:

```json
{ "name": "…", "email": "…", "message": "…", "website": "" }
```

- **Validación:** `name` de 1 a 100 caracteres, `email` válido, `message` de 10 a 5000.
- **Honeypot:** `website` debe venir vacío. Si viene con contenido, responde 202 igual, pero el mensaje no se guarda ni se envía.
- **Respuesta:** `202 { "status": "received" }`. El mensaje se guarda antes de intentar el envío por SMTP.
- **Límite:** 5 envíos por IP cada hora, y después 429.

### `POST /public/events`

Body:

```json
{ "type": "PAGE_VIEW", "path": "/proyectos/appfut", "ref": "linkedin", "targetId": null }
```

- **Origen:** lo envía `navigator.sendBeacon` desde la web.
- **Validación:** `type` acepta solo `PAGE_VIEW` y `PROJECT_CLICK`. `CV_DOWNLOAD` y `CONTACT_SUBMIT` los registra el servidor. `path` admite hasta 200 caracteres y `ref` hasta 50, con el patrón `[a-z0-9_-]`.
- **Límite:** 60 solicitudes por IP por minuto, y después 429.
- **Respuesta:** `204` siempre, también cuando la request trae sesión de admin. En ese caso no se registra nada.

### CV

#### `GET /cv` y `GET /cv/:profile`

`:profile` acepta `backend`, `mainframe` o `soporte`.

| Ruta           | Sirve                                   |
| -------------- | --------------------------------------- |
| `/cv`          | la versión vigente del perfil principal |
| `/cv/:profile` | la versión vigente de ese perfil        |

- `200 application/pdf` con `Content-Disposition: attachment; filename="CV-David-Saghatelyan-Backend.pdf"` y `Cache-Control: no-cache`. El link siempre devuelve la versión vigente.
- (Fase 4) Registra `CV_DOWNLOAD` con `targetId = cvVersionId` y `ref` (tomado de `?ref=`), **salvo que la request traiga una sesión de admin válida**.
- 404 si el perfil no tiene versión vigente.

### `GET /files/:id`

- Sirve imágenes referenciadas por contenido publicado: foto de perfil, portadas e imágenes de proyectos publicados.
- Si el archivo existe pero no está referenciado por contenido publicado, responde 404.
- `Cache-Control: public, max-age=31536000, immutable`: el id cambia con cada archivo nuevo.

## Auth

### `POST /auth/login`

Body: `{ "username": "…", "password": "…" }`

- **Éxito:** `200 { "csrfToken": "…" }` + `Set-Cookie: sid=…; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`.
- **Error:** `401 UNAUTHENTICATED` con el mismo mensaje, exista o no el usuario. Argon2 se ejecuta siempre (contra un hash ficticio si el usuario no existe), así que el tiempo de respuesta tampoco delata nada.
- **Bloqueo:** `429` con `Retry-After`.
- **Fijación de sesión:** el login revoca la sesión previa de la cookie, si existía, y crea una nueva.

### `POST /auth/logout`

`204`. Revoca la sesión y borra la cookie. Requiere CSRF.

### `GET /auth/me`

`200 { "username": "…", "csrfToken": "…" }`, o 401.

## Admin

Todas las rutas `/api/v1/admin/*`:

- Requieren una sesión válida; sin ella responden 401.
- En `POST`, `PUT`, `PATCH` y `DELETE` requieren además el header `X-CSRF-Token` igual al de la sesión; si falta o no coincide, responden 403.
- Responden con `Cache-Control: no-store` y `X-Robots-Tag: noindex`.

Los recursos de admin devuelven todas las traducciones: `translations: { es: {…}, en: {…} }`.

### Perfil

- `GET /admin/profile` · `PUT /admin/profile`: reemplaza los campos y las traducciones.
- `POST /admin/profile/photo`: multipart con el campo `file`. Imagen JPG, PNG o WebP de hasta 5 MB. Responde `200 { "photoUrl" }`.

### Recursos con CRUD estándar

`skill-categories`, `skills`, `projects`, `timeline`, `languages`:

| Método | Ruta                       | Resultado                                                          |
| ------ | -------------------------- | ------------------------------------------------------------------ |
| GET    | `/admin/<recurso>`         | lista completa, incluye borradores y ocultos                       |
| POST   | `/admin/<recurso>`         | `201` + recurso creado                                             |
| GET    | `/admin/<recurso>/:id`     | recurso                                                            |
| PATCH  | `/admin/<recurso>/:id`     | actualización parcial, incluye `published` o `status` y `featured` |
| DELETE | `/admin/<recurso>/:id`     | `204`; 409 si una categoría todavía tiene skills                   |
| PUT    | `/admin/<recurso>/reorder` | `{ "ids": ["…"] }` en el orden deseado, `204`                      |

Particularidades:

- `skills`: `{ "categoryId", "name", "level", "published", "projectIds": [] }`.
- `projects`: el `slug` es único (409 si se repite). `skillIds` reemplaza los vínculos.

### Imágenes de proyecto

- `POST /admin/projects/:id/images`: multipart con `file`, `alt` y `locale`. Mismas reglas que la foto. Responde `201`.
- `DELETE /admin/projects/:id/images/:imageId` · `PUT /admin/projects/:id/images/reorder`
- `POST /admin/projects/:id/cover`: multipart `file`.

### Previsualización

Requiere sesión. No registra métricas y responde con `X-Robots-Tag: noindex`.

- `GET /admin/projects/:id/preview?locale=es`: misma forma que `ProjectDetail`, en cualquier estado. La web lo muestra en `/admin/preview/projects/:id` con el mismo componente público.
- `GET /admin/cv/versions/:id/file`: cualquier versión del historial, con `Content-Disposition: inline`.

### CV

- `GET /admin/cv`: `[{ "profile", "currentVersionId", "versions": [{ "id", "label", "uploadedAt", "size" }] }]` más `primaryProfile`.
- `POST /admin/cv`: multipart con `profile`, `label`, `file` y `makeCurrent` (booleano, por defecto `true`). Acepta solo PDF de hasta 5 MB y responde `201`.
- `PUT /admin/cv/profiles/:profile/current { "versionId" }`: 409 si la versión es de otro perfil.
- `PUT /admin/cv/primary { "profile": "backend" }`: define qué perfil sirve `/cv`. 409 si ese perfil no tiene versión vigente.
- `DELETE /admin/cv/versions/:id`: 409 si es la vigente.

### Mensajes

- `GET /admin/messages?unread=true&limit=&cursor=`
- `PATCH /admin/messages/:id { "read": true }`
- `DELETE /admin/messages/:id`

### Métricas

`GET /admin/metrics/summary?from=YYYY-MM-DD&to=YYYY-MM-DD` responde:

```json
{
  "pageViews": 0,
  "uniqueVisitors": 0,
  "cvDownloads": 0,
  "projectClicks": 0,
  "contactSubmits": 0,
  "byRef": [{ "ref": "linkedin", "pageViews": 0, "cvDownloads": 0 }],
  "byCvVersion": [{ "profile": "backend", "versionId": "…", "label": "…", "downloads": 0 }],
  "topPages": [{ "path": "/", "views": 0 }],
  "topProjects": [{ "slug": "…", "clicks": 0 }]
}
```

`GET /admin/metrics/timeseries?type=PAGE_VIEW&from&to` devuelve `[{ "date": "2026-11-05", "count": 0 }]`.

`uniqueVisitors` suma los visitantes únicos de cada día, así que una misma persona que vuelve otro día cuenta otra vez (ver [modelo de datos](modelo-datos.md#event)).
