import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp, type AppDeps } from '../../src/app.js';
import type { Db } from '../../src/db/client.js';
import type { ContactEmail, Mailer } from '../../src/modules/contact/mailer.js';
import { LocalDiskStorage } from '../../src/storage/local-disk-storage.js';

/** App real con base de tests y un directorio temporal como almacenamiento. */
const NO_LIMIT = { limit: 100_000, windowMs: 60_000 };

/** Mailer de prueba: guarda lo que se envía, y falla si se le pide. */
export class FakeMailer implements Mailer {
  sent: ContactEmail[] = [];
  failWith: Error | null = null;

  sendContactEmail(message: ContactEmail) {
    if (this.failWith) return Promise.reject(this.failWith);
    this.sent.push(message);
    return Promise.resolve();
  }
}

export async function createTestApp(db: Db, options: Pick<AppDeps, 'rateLimits'> = {}) {
  const uploadsDir = await mkdtemp(path.join(tmpdir(), 'portfolio-test-'));
  const storage = new LocalDiskStorage(uploadsDir);
  const mailer = new FakeMailer();
  // Sin límite por IP salvo en las pruebas que lo verifican: todos los casos comparten la IP.
  const rateLimits = {
    login: NO_LIMIT,
    contact: NO_LIMIT,
    events: NO_LIMIT,
    ...options.rateLimits,
  };
  const app = createApp({ db, storage, mailer, rateLimits });
  return {
    app,
    uploadsDir,
    mailer,
    storage,
    cleanup: () => rm(uploadsDir, { recursive: true, force: true }),
  };
}

/** PDF mínimo válido (empieza con %PDF-). */
export const samplePdf = (text = 'cv') =>
  Buffer.from(`%PDF-1.4\n% ${text}\n1 0 obj << /Type /Catalog >> endobj\ntrailer << >>\n%%EOF\n`);

/** PNG de 1×1 válido. */
export const samplePng = () =>
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
