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

Se cargan desde el panel (`/admin/cv`) o por consola:

```sh
docker compose cp ./mi-cv.pdf api:/tmp/cv.pdf
docker compose exec api node dist/cli/cv-import.js --profile backend --file /tmp/cv.pdf --label "Noviembre 2026"
```

- **Descarga:** <http://localhost:8080/cv> sirve el perfil principal, y `/cv/backend`, `/cv/mainframe` o `/cv/soporte` sirven la versión vigente de cada perfil.
- **Validación:** solo se aceptan PDF reales (verificados por su contenido) de hasta 5 MB.
- **Reemplazo:** cada carga crea una versión nueva y conserva las anteriores.

### Cargar la foto de perfil

```sh
docker compose cp ./foto.jpg api:/tmp/foto.jpg
docker compose exec api node dist/cli/photo-import.js --file /tmp/foto.jpg
```

La imagen se valida (JPG, PNG o WebP, hasta 5 MB) y se guarda como WebP, sin metadatos (EXIF, GPS).

### Email de contacto

Los mensajes del formulario se guardan siempre y se ven en `/admin/mensajes`. Para recibirlos también por email, completá las variables `SMTP_*` y `CONTACT_TO` del `.env` (ver `.env.example`) y reiniciá la API. Con Gmail hace falta una contraseña de aplicación.

### Panel

`/admin`, con el usuario creado por `admin-create`. Permite editar perfil, proyectos, trayectoria, skills, idiomas y CV. Los cambios se ven en el sitio en un minuto como máximo, sin redesplegar.

### Administrador

No hay registro por la web. Los dos comandos piden los datos en la terminal, sin eco:

```bash
# Crea el único administrador. Falla si ya existe uno.
docker compose exec -it api node dist/cli/admin-create.js
# Cambia la contraseña y revoca todas las sesiones.
docker compose exec -it api node dist/cli/admin-password.js
```

Fuera de Docker: `npm run admin:create -w apps/api` y `npm run admin:password -w apps/api`.

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
npm run test:e2e:up    # levanta un stack aislado para Playwright (puerto 8081)
npm run test:e2e       # Playwright contra ese stack: edita contenido, no toca el de desarrollo
npm run test:e2e:down  # lo baja y borra sus datos
npm run build
```

Para los tests hace falta `npm run db:up`, y para los end-to-end, `npm run test:e2e:up` más `npx playwright install chromium` la primera vez. Por seguridad, solo corren contra una base cuyo nombre termina en `_test`.

El CI (GitHub Actions) ejecuta todo lo anterior y además:

- `npm audit` de las dependencias de producción;
- el build de las imágenes Docker;
- las pruebas end-to-end contra el stack completo;
- un escaneo de secretos con gitleaks.

## Producción

Los pasos completos, la comparación de proveedores y lo que falta probar están en [docs/deploy.md](docs/deploy.md).

```sh
docker compose -f compose.yaml -f compose.prod.yaml up -d --build
```

Con `compose.prod.yaml`:

- compose no arranca si falta una variable obligatoria;
- la API no arranca con la contraseña de ejemplo o con `SITE_URL` sin https;
- el seed no corre solo;
- Caddy obtiene el certificado TLS para `SITE_ADDRESS`;
- un servicio hace backups cifrados cada día.

```sh
npm run test:restore            # backup y restauración de punta a punta, en un stack aislado
bash scripts/https-smoke-test.sh # HTTPS con la CA interna de Caddy
```
