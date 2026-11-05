#!/bin/sh
set -eu

# 1. Migraciones versionadas: siempre, son idempotentes.
node /app/node_modules/prisma/build/index.js migrate deploy

# 2. Seed (D-011): automático solo en desarrollo, y aun así carga datos solo si la base
#    no tiene contenido. En producción nunca corre al arrancar: se ejecuta a mano con
#    `docker compose exec api node dist/cli/seed.js`.
if [ "${APP_ENV:-development}" = "development" ]; then
  node dist/cli/seed.js
fi

# 3. API (exec: recibe las señales de Docker y se apaga ordenadamente).
exec node dist/server.js
