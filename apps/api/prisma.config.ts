import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// En desarrollo, las variables viven en el .env de la raíz del monorepo.
// En Docker y en CI llegan como variables de entorno reales.
const rootEnv = new URL('../../.env', import.meta.url);
if (!process.env.DATABASE_URL && existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // generate no necesita conexión; migrate sí, y falla con un error claro si falta la URL.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
