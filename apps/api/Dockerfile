# syntax=docker/dockerfile:1
# Se construye desde la raíz del monorepo: docker build -f apps/api/Dockerfile .

FROM node:26-slim AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false

# ── Dependencias (capa cacheable: solo cambia con el lockfile) ──
FROM base AS deps
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w apps/api --include-workspace-root=false --ignore-scripts

# ── Build ──
FROM deps AS build
COPY tsconfig.base.json ./
COPY apps/api apps/api
RUN npm exec -w apps/api -- prisma generate && npm run build -w apps/api

# ── Runtime ──
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# prisma (CLI) es dependencia de producción: aplica las migraciones al arrancar.
# --ignore-scripts evita scripts arbitrarios; solo se ejecuta el de @prisma/engines (aprobado
# en allowScripts), que descarga el motor de migraciones mientras la imagen todavía es escribible.
RUN npm ci -w apps/api --include-workspace-root=false --omit=dev --ignore-scripts \
  && npm rebuild @prisma/engines \
  && npm cache clean --force \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
  && rm -rf node_modules/typescript node_modules/@types node_modules/.bin/tsc node_modules/.bin/tsserver
# npm no se usa en ejecución: sacarlo reduce lo que un atacante tendría a mano, y también las
# vulnerabilidades de sus dependencias, que venían en la imagen base.
# El CLI de Prisma arrastra TypeScript y tipos que nada usa al ejecutar: no llegan a producción.
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
COPY apps/api/docker-entrypoint.sh apps/api/
RUN mkdir -p /data/uploads && chown -R node:node /data/uploads \
  && chmod +x apps/api/docker-entrypoint.sh

USER node
WORKDIR /app/apps/api
EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
