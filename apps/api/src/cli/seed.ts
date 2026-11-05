import { loadEnv } from '../config/env.js';
import { createDb } from '../db/client.js';
import { runSeed } from '../seed/seed.js';

// Uso: npm run seed -w apps/api  (en Docker: docker compose exec api node dist/cli/seed.js)
const env = loadEnv();
const db = createDb(env.DATABASE_URL);
try {
  const result = await runSeed(db);
  console.log(
    result.status === 'seeded'
      ? 'Seed: contenido inicial cargado.'
      : `Seed: omitido (${result.reason}). No se modificó nada.`,
  );
} finally {
  await db.$disconnect();
}
