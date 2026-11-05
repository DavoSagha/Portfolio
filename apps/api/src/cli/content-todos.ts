import { loadEnv } from '../config/env.js';
import { findPendingContent } from '../content/pending-content.js';
import { createDb } from '../db/client.js';

// Uso: npm run content:todos -w apps/api. Sale con código 1 si queda algo pendiente.
const env = loadEnv();
const db = createDb(env.DATABASE_URL);
try {
  const pending = await findPendingContent(db);
  if (pending.length === 0) {
    console.log('Sin contenido pendiente.');
  } else {
    console.log(`Contenido pendiente (${pending.length}):`);
    for (const item of pending) console.log(`  - ${item}`);
    process.exitCode = 1;
  }
} finally {
  await db.$disconnect();
}
