import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createDb } from './db/client.js';
import { AuthRepository } from './modules/auth/auth.repository.js';
import { LocalDiskStorage } from './storage/local-disk-storage.js';

const PURGE_AFTER_MS = 24 * 60 * 60 * 1000;
const PURGE_EVERY_MS = 60 * 60 * 1000;

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const app = createApp({ db, storage: new LocalDiskStorage(env.UPLOADS_DIR) });

const authRepository = new AuthRepository(db);
const purge = () =>
  authRepository
    .purgeExpired(new Date(Date.now() - PURGE_AFTER_MS))
    .catch((err: unknown) => console.error('No se pudieron limpiar las sesiones:', err));
void purge();
// unref: este temporizador no impide que el proceso termine.
setInterval(() => void purge(), PURGE_EVERY_MS).unref();

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
