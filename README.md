# Portfolio

Portfolio profesional con sitio público y, más adelante, un panel de administración privado. Es un monorepo con:

- **API:** Node.js, TypeScript, Express 5, Zod, PostgreSQL y Prisma.
- **Web:** Next.js 16 y Tailwind CSS 4.
- **Infraestructura:** Docker Compose con Caddy como proxy inverso.

```
apps/api   API REST en capas: routes → controllers → services → repositories
apps/web   Sitio público renderizado en el servidor (sin lógica de negocio)
docs/      Plan, modelo de datos, contratos de API, diseño, decisiones y seguridad
```

La documentación de diseño y las decisiones con sus alternativas están en [`docs/`](docs/plan.md).

## Requisitos

- Docker con Docker Compose.
- Node.js 26 LTS: solo para desarrollar fuera de Docker (ver `.nvmrc`).

## Instalación desde cero (un comando)

```sh
docker compose up --build
```

Abrir <http://localhost:8080>. El comando:

- levanta PostgreSQL, la API, la web y Caddy;
- aplica las migraciones;
- en desarrollo, carga el contenido inicial si la base está vacía.

No hace falta un `.env` para probarlo en local: `compose.yaml` trae valores de desarrollo. Para cambiarlos, copiar `.env.example` a `.env`.

### Cargar un CV

Mientras no exista el panel (Fase 3), los PDF se cargan por consola:

```sh
docker compose cp ./mi-cv.pdf api:/tmp/cv.pdf
docker compose exec api node dist/cli/cv-import.js --profile backend --file /tmp/cv.pdf --label "Noviembre 2026"
```

- **Descarga:** <http://localhost:8080/cv> sirve el perfil principal, y `/cv/backend`, `/cv/mainframe` o `/cv/soporte` sirven la versión vigente de cada perfil.
- **Validación:** solo se aceptan PDF reales (verificados por su contenido) de hasta 5 MB.
- **Reemplazo:** cada carga crea una versión nueva y conserva las anteriores.

### Contenido pendiente

Los datos que todavía faltan se ven resaltados en el sitio (`TODO: …`). Para listarlos:

```sh
docker compose exec api node dist/cli/content-todos.js
```

## Desarrollo local

```sh
npm ci                 # instala dependencias y genera el cliente de Prisma
npm run db:up          # Postgres en localhost:5432 (crea también la base de tests)
cp .env.example .env   # variables de desarrollo
npm run db:migrate     # aplica las migraciones
npm run db:seed        # contenido inicial (solo si la base está vacía)
npm run dev:api        # API en http://localhost:4000
npm run dev:web        # en otra terminal: web en http://localhost:3000
```

## Calidad

```sh
npm run lint           # ESLint (incluye reglas de accesibilidad para la web)
npm run format:check   # Prettier
npm run typecheck      # TypeScript estricto en ambas apps
npm test               # Vitest + Supertest contra PostgreSQL real (base *_test)
npm run build
```

Para los tests hace falta `npm run db:up`. Por seguridad, solo corren contra una base cuyo nombre termina en `_test`.

El CI (GitHub Actions) ejecuta todo lo anterior y además:

- `npm audit` de las dependencias de producción;
- el build de las imágenes Docker;
- un escaneo de secretos con gitleaks.

## Producción

Se documenta en la Fase 5: VPS, dominio, HTTPS automático con Caddy y backups. Con `APP_ENV=production`:

- la API se niega a arrancar con la contraseña de ejemplo o con `SITE_URL` sin https;
- el seed no se ejecuta al arrancar.
