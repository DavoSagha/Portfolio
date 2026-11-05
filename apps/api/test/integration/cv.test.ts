import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CvRepository } from '../../src/modules/cv/cv.repository.js';
import { cvFileName, CvService, CV_MAX_BYTES } from '../../src/modules/cv/cv.service.js';
import { runSeed } from '../../src/seed/seed.js';
import { createTestApp, samplePdf, samplePng } from '../helpers/app.js';
import { createTestDb, resetDb } from '../helpers/db.js';

const db = createTestDb();
let ctx: Awaited<ReturnType<typeof createTestApp>>;
let service: CvService;

const binary = (res: request.Response, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

beforeAll(async () => {
  ctx = await createTestApp(db);
  service = new CvService(new CvRepository(db), ctx.storage);
});
afterAll(async () => {
  await ctx.cleanup();
  await db.$disconnect();
});
beforeEach(async () => {
  await resetDb(db);
  await runSeed(db);
});

const importCv = (
  profileKey: 'BACKEND' | 'MAINFRAME' | 'SOPORTE',
  text: string,
  makeCurrent = true,
) =>
  service.importVersion({
    profileKey,
    label: text,
    data: samplePdf(text),
    originalName: `${text}.pdf`,
    makeCurrent,
  });

describe('descarga del CV', () => {
  it('responde 404 si el perfil no tiene versión vigente', async () => {
    expect((await request(ctx.app).get('/cv')).status).toBe(404);
    expect((await request(ctx.app).get('/cv/backend')).status).toBe(404);
  });

  it('un perfil inexistente responde 404', async () => {
    expect((await request(ctx.app).get('/cv/marketing')).status).toBe(404);
  });

  it('descarga la versión vigente con un nombre de archivo claro', async () => {
    await importCv('BACKEND', 'backend-v1');
    const res = await request(ctx.app).get('/cv/backend').buffer(true).parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="CV-David-Saghatelyan-Backend.pdf"',
    );
    expect(res.headers['cache-control']).toBe('no-cache');
    expect((res.body as Buffer).toString()).toContain('backend-v1');
  });

  it('al reemplazar el CV, el mismo link descarga la nueva versión y el historial se conserva', async () => {
    await importCv('BACKEND', 'backend-v1');
    await importCv('BACKEND', 'backend-v2');
    const res = await request(ctx.app).get('/cv/backend').buffer(true).parse(binary);
    expect((res.body as Buffer).toString()).toContain('backend-v2');
    expect(await db.cvVersion.count({ where: { profileKey: 'BACKEND' } })).toBe(2);
  });

  it('una versión cargada sin marcar vigente no cambia la descarga', async () => {
    await importCv('BACKEND', 'backend-v1');
    await importCv('BACKEND', 'backend-borrador', false);
    const res = await request(ctx.app).get('/cv/backend').buffer(true).parse(binary);
    expect((res.body as Buffer).toString()).toContain('backend-v1');
  });

  it('/cv sirve el perfil principal y el inicio lo informa', async () => {
    await importCv('BACKEND', 'backend-v1');
    await importCv('MAINFRAME', 'mainframe-v1');
    await db.profile.update({ where: { id: 1 }, data: { primaryCvProfile: 'MAINFRAME' } });

    const res = await request(ctx.app).get('/cv').buffer(true).parse(binary);
    expect(res.headers['content-disposition']).toContain('CV-David-Saghatelyan-Mainframe.pdf');
    expect((res.body as Buffer).toString()).toContain('mainframe-v1');

    const home = await request(ctx.app).get('/api/v1/public/home');
    expect(home.body.cv).toEqual({ primaryUrl: '/cv', profiles: ['backend', 'mainframe'] });
  });
});

describe('importación del CV', () => {
  it('rechaza archivos que no son PDF aunque se llamen .pdf', async () => {
    await expect(
      service.importVersion({
        profileKey: 'BACKEND',
        label: 'falso',
        data: samplePng(),
        originalName: 'cv.pdf',
        makeCurrent: true,
      }),
    ).rejects.toMatchObject({ status: 415, code: 'UNSUPPORTED_FILE_TYPE' });
    expect(await db.storedFile.count()).toBe(0);
  });

  it('rechaza archivos de más de 5 MB', async () => {
    const big = Buffer.concat([samplePdf(), Buffer.alloc(CV_MAX_BYTES)]);
    await expect(
      service.importVersion({
        profileKey: 'BACKEND',
        label: 'grande',
        data: big,
        originalName: 'cv.pdf',
        makeCurrent: true,
      }),
    ).rejects.toMatchObject({ status: 413 });
  });

  it('guarda tamaño, tipo y hash, con un nombre generado por el sistema', async () => {
    const version = await importCv('SOPORTE', 'soporte-v1');
    const file = await db.storedFile.findFirstOrThrow({
      where: { cvVersions: { some: { id: version.id } } },
    });
    expect(file.mimeType).toBe('application/pdf');
    expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(file.storageKey).not.toContain('soporte-v1');
  });
});

describe('cvFileName', () => {
  it('genera un nombre ASCII seguro', () => {
    expect(cvFileName('David Saghatelyan', 'SOPORTE')).toBe('CV-David-Saghatelyan-Soporte.pdf');
    expect(cvFileName('José Pérez "Pepe"', 'BACKEND')).toBe('CV-Jose-Perez-Pepe-Backend.pdf');
  });
});
