import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createDb } from './db/client.js';
import { AuthRepository } from './modules/auth/auth.repository.js';
import { DisabledMailer, SmtpMailer } from './modules/contact/mailer.js';
import { MetricsRepository } from './modules/metrics/metrics.repository.js';
import { eventRetentionCutoff } from './modules/metrics/metrics.service.js';
import { LocalDiskStorage } from './storage/local-disk-storage.js';

const PURGE_AFTER_MS = 24 * 60 * 60 * 1000;
const PURGE_EVERY_MS = 60 * 60 * 1000;

const env = loadEnv();
const db = createDb(env.DATABASE_URL);

function createMailer() {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.CONTACT_TO) {
    console.warn('SMTP sin configurar: los mensajes de contacto se guardan pero no se envían.');
    return new DisabledMailer();
  }
  return new SmtpMailer({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM ?? env.SMTP_USER,
    to: env.CONTACT_TO,
    requireTls: env.APP_ENV === 'production',
  });
}

const app = createApp({
  db,
  storage: new LocalDiskStorage(env.UPLOADS_DIR),
  mailer: createMailer(),
});

const authRepository = new AuthRepository(db);
const metricsRepository = new MetricsRepository(db);
const maintenance = async () => {
  try {
    await authRepository.purgeExpired(new Date(Date.now() - PURGE_AFTER_MS));
    const deleted = await metricsRepository.deleteEventsBefore(eventRetentionCutoff());
    if (deleted > 0) console.log(`Retención: ${deleted} eventos de más de 12 meses borrados.`);
  } catch (err) {
    console.error('Falló el mantenimiento periódico:', err);
  }
};
void maintenance();
// unref: este temporizador no impide que el proceso termine.
setInterval(() => void maintenance(), PURGE_EVERY_MS).unref();

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
