import { createHash } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runSeed } from '../../src/seed/seed.js';
import { createTestApp, samplePng } from '../helpers/app.js';
import { createTestDb, resetDb } from '../helpers/db.js';

const db = createTestDb();
let ctx: Awaited<ReturnType<typeof createTestApp>>;

beforeAll(async () => {
  ctx = await createTestApp(db);
});
afterAll(async () => {
  await ctx.cleanup();
  await db.$disconnect();
});
beforeEach(async () => {
  await resetDb(db);
  await runSeed(db);
});

async function storeImage() {
  const data = samplePng();
  const { key } = await ctx.storage.put(data, 'png');
  return db.storedFile.create({
    data: {
      storageKey: key,
      originalName: 'foto.png',
      mimeType: 'image/png',
      size: data.length,
      sha256: createHash('sha256').update(data).digest('hex'),
    },
  });
}

describe('GET /files/:id', () => {
  it('sirve la foto de perfil con caché larga y la expone en el inicio', async () => {
    const file = await storeImage();
    await db.profile.update({ where: { id: 1 }, data: { photoFileId: file.id } });

    const res = await request(ctx.app).get(`/files/${file.id}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['cache-control']).toContain('immutable');

    const home = await request(ctx.app).get('/api/v1/public/home');
    expect(home.body.profile.photoUrl).toBe(`/files/${file.id}`);
  });

  it('no sirve archivos que no están referenciados por contenido publicado', async () => {
    const file = await storeImage();
    expect((await request(ctx.app).get(`/files/${file.id}`)).status).toBe(404);

    // Portada de un proyecto en borrador: tampoco.
    await db.project.update({
      where: { slug: 'appfut' },
      data: { coverFileId: file.id, status: 'DRAFT' },
    });
    expect((await request(ctx.app).get(`/files/${file.id}`)).status).toBe(404);

    await db.project.update({ where: { slug: 'appfut' }, data: { status: 'PUBLISHED' } });
    expect((await request(ctx.app).get(`/files/${file.id}`)).status).toBe(200);
  });

  it('no expone los CV por esta ruta', async () => {
    const file = await storeImage();
    await db.cvVersion.create({ data: { profileKey: 'BACKEND', fileId: file.id, label: 'x' } });
    expect((await request(ctx.app).get(`/files/${file.id}`)).status).toBe(404);
  });

  it('ids con formato inválido responden 404', async () => {
    expect((await request(ctx.app).get('/files/..%2F..%2Fetc')).status).toBe(404);
  });
});
