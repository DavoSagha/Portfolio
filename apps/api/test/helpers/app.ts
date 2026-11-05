import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp, type AppDeps } from '../../src/app.js';
import type { Db } from '../../src/db/client.js';
import { LocalDiskStorage } from '../../src/storage/local-disk-storage.js';

/** App real con base de tests y un directorio temporal como almacenamiento. */
const NO_LIMIT = { limit: 100_000, windowMs: 60_000 };

export async function createTestApp(db: Db, options: Pick<AppDeps, 'loginRateLimit'> = {}) {
  const uploadsDir = await mkdtemp(path.join(tmpdir(), 'portfolio-test-'));
  const storage = new LocalDiskStorage(uploadsDir);
  // Sin límite por IP salvo en la prueba que lo verifica: todos los casos comparten la IP.
  const app = createApp({ db, storage, loginRateLimit: options.loginRateLimit ?? NO_LIMIT });
  return {
    app,
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
