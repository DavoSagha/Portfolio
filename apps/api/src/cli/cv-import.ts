import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { loadEnv } from '../config/env.js';
import { createDb } from '../db/client.js';
import type { CvProfileKey } from '../generated/prisma/enums.js';
import { AppError } from '../http/errors.js';
import { CvRepository } from '../modules/cv/cv.repository.js';
import { CvService } from '../modules/cv/cv.service.js';
import { LocalDiskStorage } from '../storage/local-disk-storage.js';

/*
 * Carga una versión del CV mientras no exista el panel (Fase 3).
 * Uso: npm run cv:import -w apps/api -- --profile backend --file ./cv.pdf --label "Noviembre 2026"
 * Por defecto la nueva versión queda vigente; --no-current la agrega solo al historial.
 */
const { values } = parseArgs({
  options: {
    profile: { type: 'string' },
    file: { type: 'string' },
    label: { type: 'string' },
    'no-current': { type: 'boolean', default: false },
  },
});

const args = z
  .object({
    profile: z.enum(['backend', 'mainframe', 'soporte']),
    file: z.string().min(1),
    label: z.string().min(1).max(100),
  })
  .safeParse(values);

if (!args.success) {
  console.error(
    'Uso: cv:import --profile backend|mainframe|soporte --file <ruta.pdf> --label "<etiqueta>" [--no-current]',
  );
  process.exit(1);
}

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
try {
  const service = new CvService(new CvRepository(db), new LocalDiskStorage(env.UPLOADS_DIR));
  const version = await service.importVersion({
    profileKey: args.data.profile.toUpperCase() as CvProfileKey,
    label: args.data.label,
    data: await readFile(args.data.file),
    originalName: path.basename(args.data.file),
    makeCurrent: !values['no-current'],
  });
  console.log(`CV cargado: versión ${version.id} del perfil ${args.data.profile}.`);
} catch (err) {
  console.error(err instanceof AppError ? `Error: ${err.message}` : err);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
