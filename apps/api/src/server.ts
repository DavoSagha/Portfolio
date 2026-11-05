import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createDb } from './db/client.js';
import { LocalDiskStorage } from './storage/local-disk-storage.js';

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const app = createApp({ db, storage: new LocalDiskStorage(env.UPLOADS_DIR) });

const server = app.listen(env.PORT, () => {
  console.log(`API escuchando en el puerto ${env.PORT} (${env.APP_ENV})`);
});

async function shutdown(signal: string) {
  console.log(`${signal} recibido, cerrando…`);
  server.close();
  await db.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
