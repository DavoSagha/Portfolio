import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadEnv } from '../config/env.js';
import { createDb } from '../db/client.js';
import { AppError } from '../http/errors.js';
import { FilesRepository } from '../modules/files/files.repository.js';
import { ImageService } from '../modules/files/image.service.js';
import { LocalDiskStorage } from '../storage/local-disk-storage.js';

/*
 * Carga la foto de perfil mientras no exista el panel (Fase 3).
 * La imagen se valida y se reprocesa: se guarda como WebP sin metadatos (EXIF, GPS).
 * Uso: npm run photo:import -w apps/api -- --file ./foto.jpg
 */
const { values } = parseArgs({ options: { file: { type: 'string' } } });
if (!values.file) {
  console.error('Uso: photo:import --file <ruta.jpg|png|webp>');
  process.exit(1);
}

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
try {
  const service = new ImageService(new FilesRepository(db), new LocalDiskStorage(env.UPLOADS_DIR));
  const file = await service.importProfilePhoto({
    data: await readFile(values.file),
    originalName: path.basename(values.file),
  });
  console.log(
    `Foto cargada: /files/${file.id} (${Math.round(file.size / 1024)} KB, WebP sin metadatos).`,
  );
} catch (err) {
  console.error(err instanceof AppError ? `Error: ${err.message}` : err);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
