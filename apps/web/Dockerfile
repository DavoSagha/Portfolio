# syntax=docker/dockerfile:1
# Se construye desde la raíz del monorepo: docker build -f apps/web/Dockerfile .

FROM node:26-slim AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json .npmrc ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN npm ci -w apps/web --include-workspace-root=false --ignore-scripts

FROM deps AS build
# Los rewrites de next.config se fijan en el build: apuntan a la API dentro de la red de Docker.
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=${API_INTERNAL_URL}
COPY tsconfig.base.json ./
COPY apps/web apps/web
RUN npm run build -w apps/web

# ── Runtime: solo el servidor standalone y los assets estáticos ──
FROM base AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
# El servidor standalone no usa npm: sin él hay menos superficie y menos dependencias vulnerables.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
