# Modelo de datos

PostgreSQL con Prisma. Convenciones:

- **IDs:** `cuid` (texto), salvo los singletons y las claves enumeradas.
- **Fechas:** `timestamptz`, siempre en UTC.
- **Orden:** el orden manual se guarda en un campo `order` (entero). Reordenar reescribe los `order` en una transacción.
- **Publicación:** `published` (booleano) en las entidades que se publican u ocultan. `Project` usa `status` porque tiene estado borrador.
- **Borrado:** borrado real. Las referencias a archivos se limpian en el mismo servicio que borra la entidad.

## Internacionalización

Cada entidad con texto visible se divide en dos tablas:

- **La base:** tiene los campos neutros, como fechas, URLs, orden y estado.
- **La tabla `<Entidad>Translation`:** tiene los textos por idioma.

```
Locale = es | en | fr

<Entidad>Translation
  entityId  → <Entidad>.id  (onDelete: Cascade)
  locale    Locale
  …campos de texto
  @@id([entityId, locale])   // clave primaria compuesta: una traducción por idioma
```

- Para sumar un idioma alcanza con insertar filas: no hace falta migración ni cambio de diseño.
- La API recibe `?locale=`. Si falta la traducción pedida, devuelve la de `es` (idioma por defecto).
- El selector de idioma de la web se muestra solo si existe contenido publicado en otro idioma. La API lo informa en `availableLocales`.
- Los nombres propios y técnicos no se traducen: nombre de skill, organización, `slug`.

> **Datos pendientes:** un texto faltante se guarda como `TODO: …` y un enumerado o URL faltante queda en `null` (ver [D-024](decisiones.md#d-024-datos-pendientes-explícitos-no-inventados)).

## Diagrama

```
AdminUser 1─* Session
LoginThrottle (independiente)

Profile (singleton) ─ ProfileTranslation
   └─ photo → StoredFile

SkillCategory 1─* Skill *─* Project   (ProjectSkill)
Project 1─* ProjectImage ─→ StoredFile
Project ─→ cover StoredFile
TimelineEntry  (EXPERIENCE | EDUCATION | CERTIFICATION)
Language

CvProfile 1─* CvVersion ─→ StoredFile
CvProfile ─→ currentVersion (CvVersion)

ContactMessage
Event
```

## Autenticación

### AdminUser

| Campo                | Tipo        | Notas                               |
| -------------------- | ----------- | ----------------------------------- |
| id                   | cuid        |                                     |
| username             | text, único |                                     |
| passwordHash         | text        | Argon2id (incluye sal y parámetros) |
| createdAt, updatedAt | timestamptz |                                     |

Hay un solo administrador. Lo crea el comando `admin:create`, que falla si ya existe uno. No hay endpoint de registro.

### Session

| Campo      | Tipo         | Notas                                                              |
| ---------- | ------------ | ------------------------------------------------------------------ |
| id         | cuid         |                                                                    |
| tokenHash  | text, único  | SHA-256 del token de la cookie. El token en claro nunca se guarda. |
| userId     | → AdminUser  | onDelete: Cascade                                                  |
| csrfToken  | text         | aleatorio, ligado a la sesión                                      |
| createdAt  | timestamptz  |                                                                    |
| lastSeenAt | timestamptz  | se actualiza como máximo una vez por minuto                        |
| expiresAt  | timestamptz  | límite absoluto: `createdAt + 7 días`                              |
| revokedAt  | timestamptz? | logout o cambio de contraseña                                      |
| userAgent  | text?        | para listar sesiones activas                                       |

Una sesión es válida si cumple las tres condiciones:

- `revokedAt` es nulo.
- `now < expiresAt`.
- `now < lastSeenAt + 2 h` (expiración por inactividad).

Índice en `(userId, revokedAt)`.

### LoginThrottle

| Campo       | Tipo         | Notas                                 |
| ----------- | ------------ | ------------------------------------- |
| keyHash     | text, PK     | SHA-256 de `usernameNormalizado + ip` |
| failures    | int          |                                       |
| lockedUntil | timestamptz? |                                       |
| updatedAt   | timestamptz  |                                       |

Se aplica igual exista o no el usuario. Con 5 fallos se bloquea por 15 min, y un login exitoso borra la fila. Hay además un límite por IP en memoria (ver [seguridad](seguridad.md)).

## Contenido

### Profile

Singleton (`id = 1`).

| Campo                  | Tipo          | Notas                                       |
| ---------------------- | ------------- | ------------------------------------------- |
| fullName               | text          |                                             |
| location               | text          | ubicación general, p. ej. "CABA, Argentina" |
| linkedinUrl, githubUrl | text?         |                                             |
| publicEmail            | text?         |                                             |
| showEmail              | boolean       | por defecto `false`                         |
| photoFileId            | → StoredFile? |                                             |
| primaryCvProfile       | CvProfileKey  | perfil que sirve `/cv`                      |
| updatedAt              | timestamptz   |                                             |

**ProfileTranslation:** `headline`, `valueProp`, `summary`, `availability`.

### SkillCategory y Skill

| SkillCategory        | Tipo |
| -------------------- | ---- |
| id, order, published |      |

**SkillCategoryTranslation:** `name`.

| Skill            | Tipo                              | Notas                                                                                                                             |
| ---------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| id               | cuid                              |                                                                                                                                   |
| categoryId       | → SkillCategory                   | onDelete: Restrict                                                                                                                |
| name             | text                              | no se traduce                                                                                                                     |
| level            | `BASIC \| INTERMEDIATE \| SOLID`? | null = nivel sin definir. Se muestra como texto ("básico", "intermedio", "sólido"), sin barras. Una skill sin nivel no se publica |
| order, published |                                   |                                                                                                                                   |

**ProjectSkill:** tabla `(projectId, skillId)` con PK compuesta. Vincula cada skill con los proyectos donde se usó.

Una skill con `published = false` no aparece en el sitio. Una categoría se muestra solo si tiene al menos una skill publicada.

### Project

| Campo                | Tipo                                    | Notas                                         |
| -------------------- | --------------------------------------- | --------------------------------------------- |
| id                   | cuid                                    |                                               |
| slug                 | text, único                             | URL `/proyectos/:slug`                        |
| status               | `DRAFT \| PUBLISHED`                    |                                               |
| featured             | boolean                                 | por defecto `false`; destacados en el inicio  |
| team                 | `INDIVIDUAL \| GROUP`?                  | null = dato pendiente (no se muestra)         |
| origin               | `ACADEMIC \| PERSONAL \| PROFESSIONAL`? | null = dato pendiente (no se muestra)         |
| inProgress           | boolean                                 | por defecto `false`; etiqueta "En desarrollo" |
| stack                | text[]                                  | tecnologías en orden; texto libre             |
| startDate, endDate   | date?                                   |                                               |
| demoUrl, repoUrl     | text?                                   | se muestran solo si existen                   |
| coverFileId          | → StoredFile?                           |                                               |
| order                | int                                     |                                               |
| createdAt, updatedAt | timestamptz                             |                                               |

Índice `(status, featured, order)`.

**ProjectTranslation:** `title`, `summary` (problema en una línea, para la tarjeta), `role`, `context`, `problem`, `solution`, `architecture`, `decisions`, `challenges`, `learnings`, `limitations?` y `disclaimer?`. Si `disclaimer` tiene texto, se muestra destacado en la tarjeta y en el detalle; es el caso de un proyecto sin afiliación con la marca que usa. Un texto vacío no se muestra: ni el aporte (`role`) ni las secciones del detalle ([D-029](decisiones.md#d-029-stack-estado-y-secciones-vacías-de-los-proyectos)).

`demoNote?` es un aviso opcional junto al link de la demo (por ejemplo, que puede tardar en cargar por estar en un hosting gratuito). Se muestra solo si hay demo.

**ProjectImage:** `id`, `projectId` (Cascade), `fileId`, `order`. **ProjectImageTranslation:** `alt`.

### TimelineEntry

Una sola tabla para experiencia, educación y certificaciones: comparten forma, se ordenan por fecha y alimentan la misma línea de tiempo. Así hay un solo CRUD en lugar de tres.

| Campo            | Tipo                                       | Notas                                                                                |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------------------------------ |
| id               | cuid                                       |                                                                                      |
| type             | `EXPERIENCE \| EDUCATION \| CERTIFICATION` |                                                                                      |
| organization     | text                                       |                                                                                      |
| startDate        | date                                       | se muestra con precisión de mes                                                      |
| endDate          | date?                                      | nulo = "actualidad" (en certificaciones: solo fecha de emisión)                      |
| datePrecision    | `MONTH \| YEAR`                            | precisión para mostrar las fechas; las certificaciones suelen conocerse solo por año |
| credentialUrl    | text?                                      | certificaciones                                                                      |
| relatedProjectId | → Project?                                 | vincula una certificación con su proyecto sin duplicar texto                         |
| order            | int                                        | desempate dentro de la misma fecha                                                   |
| published        | boolean                                    |                                                                                      |

**TimelineEntryTranslation:** `title` (puesto, carrera o certificación) y `description`.

El orden público es `startDate` descendente y después `order`.

### Language

| Campo                                                                                               | Tipo |
| --------------------------------------------------------------------------------------------------- | ---- |
| id, code (ISO 639-1, único), level (`NATIVE \| A1 \| A2 \| B1 \| B2 \| C1 \| C2`), order, published |      |

**LanguageTranslation:** `name`.

## Archivos y CV

### StoredFile

| Campo        | Tipo        | Notas                                             |
| ------------ | ----------- | ------------------------------------------------- |
| id           | cuid        |                                                   |
| storageKey   | text, único | nombre generado por el sistema, nunca el original |
| originalName | text        | solo informativo                                  |
| mimeType     | text        | detectado por magic bytes, no por extensión       |
| size         | int         | bytes                                             |
| sha256       | text        | integridad y detección de duplicados              |
| createdAt    | timestamptz |                                                   |

### CvProfile y CvVersion

| CvProfile        | Tipo                                  | Notas                      |
| ---------------- | ------------------------------------- | -------------------------- |
| key              | `BACKEND \| MAINFRAME \| SOPORTE`, PK |                            |
| currentVersionId | → CvVersion?, único                   | versión vigente del perfil |

| CvVersion  | Tipo         | Notas                   |
| ---------- | ------------ | ----------------------- |
| id         | cuid         |                         |
| profileKey | → CvProfile  |                         |
| fileId     | → StoredFile |                         |
| label      | text         | p. ej. "Noviembre 2026" |
| uploadedAt | timestamptz  |                         |

- "Vigente" es un puntero en `CvProfile`, no un booleano en cada versión. Así es imposible tener dos vigentes por perfil, sin índices parciales.
- El historial se conserva: borrar una versión es manual y no se permite si es la vigente (409).
- `/cv` usa `Profile.primaryCvProfile` → `CvProfile.currentVersionId`.

## Contacto y métricas

### ContactMessage

| Campo       | Tipo         | Notas                                             |
| ----------- | ------------ | ------------------------------------------------- |
| id          | cuid         |                                                   |
| name, email | text         |                                                   |
| body        | text         | máximo 5000 caracteres                            |
| createdAt   | timestamptz  |                                                   |
| readAt      | timestamptz? |                                                   |
| emailSentAt | timestamptz? |                                                   |
| emailError  | text?        | si el SMTP falla, el mensaje igual queda guardado |

### Event

| Campo       | Tipo                                                          | Notas                                                                          |
| ----------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| id          | bigint autoincremental                                        |                                                                                |
| type        | `PAGE_VIEW \| CV_DOWNLOAD \| PROJECT_CLICK \| CONTACT_SUBMIT` |                                                                                |
| path        | text                                                          | máximo 200 caracteres                                                          |
| ref         | text?                                                         | valor de `?ref=`, normalizado a minúsculas, máximo 50 caracteres, `[a-z0-9_-]` |
| targetId    | text?                                                         | versión de CV (`CV_DOWNLOAD`) o `slug` del proyecto (`PROJECT_CLICK`)          |
| visitorHash | text                                                          | ver abajo                                                                      |
| createdAt   | timestamptz                                                   |                                                                                |

Índices `(type, createdAt)` y `(ref, createdAt)`.

`visitorHash = SHA-256(salDiaria ‖ ip ‖ userAgent)`:

- **Sal:** se genera al azar cada día y vive solo en memoria, nunca se persiste. Al rotar, los hashes del día anterior ya no se pueden recalcular.
- **Qué permite:** contar visitantes únicos por día sin guardar la IP ni usar cookies.
- **Limitación:** si la API se reinicia, la sal cambia y un mismo visitante puede contarse dos veces ese día.

No se registran eventos de requests con sesión de admin válida.
