import { readdir } from 'node:fs/promises';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runSeed } from '../../src/seed/seed.js';
import { adminClient } from '../helpers/admin.js';
import { createTestApp, samplePdf, samplePng } from '../helpers/app.js';
import { createTestDb, resetDb } from '../helpers/db.js';

const db = createTestDb();
let ctx: Awaited<ReturnType<typeof createTestApp>>;
let admin: Awaited<ReturnType<typeof adminClient>>;

const tooBig = () => Buffer.concat([samplePng(), Buffer.alloc(5 * 1024 * 1024 + 1)]);
const png = { filename: 'foto.png', contentType: 'image/png' };
const pdf = { filename: 'cv.pdf', contentType: 'application/pdf' };

const projectId = async (slug: string) =>
  (await db.project.findUniqueOrThrow({ where: { slug } })).id;
const fileCount = () => db.storedFile.count();
const diskFiles = async () => (await readdir(ctx.uploadsDir)).length;
const uploadCv = (profile: string, text: string, makeCurrent = 'true') =>
  admin
    .post('/cv')
    .field('profile', profile)
    .field('label', `Versión ${text}`)
    .field('makeCurrent', makeCurrent)
    .attach('file', samplePdf(text), pdf);

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
  admin = await adminClient(ctx.app, db);
});
afterEach(async () => {
  // Cada prueba empieza con el directorio vacío para poder contar archivos.
  for (const file of await db.storedFile.findMany()) {
    await ctx.storage.delete(file.storageKey).catch(() => undefined);
  }
});

describe('foto de perfil', () => {
  it('reemplazarla sirve la nueva y borra la anterior de la base y del disco', async () => {
    const first = await admin.post('/profile/photo').attach('file', samplePng(), png);
    expect(first.status).toBe(200);
    const firstUrl = (await request(ctx.app).get('/api/v1/public/home')).body.profile.photoUrl;
    expect((await request(ctx.app).get(firstUrl)).headers['content-type']).toBe('image/webp');

    await admin.post('/profile/photo').attach('file', samplePng(), png);
    const secondUrl = (await request(ctx.app).get('/api/v1/public/home')).body.profile.photoUrl;
    expect(secondUrl).not.toBe(firstUrl);
    expect((await request(ctx.app).get(firstUrl)).status).toBe(404);
    expect(await fileCount()).toBe(1);
    expect(await diskFiles()).toBe(1);
  });

  it('se puede quitar', async () => {
    await admin.post('/profile/photo').attach('file', samplePng(), png);
    expect((await admin.delete('/profile/photo')).status).toBe(204);
    expect((await request(ctx.app).get('/api/v1/public/home')).body.profile.photoUrl).toBeNull();
    expect(await fileCount()).toBe(0);
    expect(await diskFiles()).toBe(0);
  });
});

describe('archivos inválidos', () => {
  it('un PDF con extensión y tipo de imagen se rechaza: vale el contenido real', async () => {
    const res = await admin.post('/profile/photo').attach('file', samplePdf(), png);
    expect(res.status).toBe(415);
    expect(await diskFiles()).toBe(0);
  });

  it('una imagen disfrazada de PDF se rechaza como CV', async () => {
    const res = await admin
      .post('/cv')
      .field('profile', 'backend')
      .field('label', 'x')
      .attach('file', samplePng(), pdf);
    expect(res.status).toBe(415);
  });

  it('un archivo de más de 5 MB responde 413 en imágenes y en CV', async () => {
    const image = await admin.post('/profile/photo').attach('file', tooBig(), png);
    expect(image.status).toBe(413);
    expect(image.body.error.code).toBe('FILE_TOO_LARGE');
    const cv = await admin
      .post('/cv')
      .field('profile', 'backend')
      .field('label', 'x')
      .attach('file', tooBig(), pdf);
    expect(cv.status).toBe(413);
  });

  it('sin archivo responde 400', async () => {
    expect((await admin.post('/profile/photo')).status).toBe(400);
  });

  it('una subida sin sesión se rechaza antes de procesar el archivo', async () => {
    const res = await request(ctx.app)
      .post('/api/v1/admin/profile/photo')
      .attach('file', samplePng(), png);
    expect(res.status).toBe(401);
    expect(await diskFiles()).toBe(0);
  });
});

describe('imágenes de proyecto', () => {
  const addImage = (id: string, alt = 'Pantalla principal') =>
    admin.post(`/projects/${id}/images`).field('alt', alt).attach('file', samplePng(), png);

  it('agrega, reordena y borra; el texto alternativo es obligatorio', async () => {
    const id = await projectId('appfut');
    expect(
      (await admin.post(`/projects/${id}/images`).attach('file', samplePng(), png)).status,
    ).toBe(400);
    const first = await addImage(id, 'Primera');
    const second = await addImage(id, 'Segunda');
    expect(first.status).toBe(201);

    await admin
      .put(`/projects/${id}/images/reorder`)
      .send({ ids: [second.body.id, first.body.id] });
    let site = await request(ctx.app).get('/api/v1/public/projects/appfut');
    expect(site.body.images.map((i: { alt: string }) => i.alt)).toEqual(['Segunda', 'Primera']);
    const url = site.body.images[0].url as string;
    expect(url).toMatch(/^\/files\//);
    expect((await request(ctx.app).get(url)).status).toBe(200);

    expect((await admin.delete(`/projects/${id}/images/${second.body.id}`)).status).toBe(204);
    site = await request(ctx.app).get('/api/v1/public/projects/appfut');
    expect(site.body.images).toHaveLength(1);
    expect((await request(ctx.app).get(url)).status).toBe(404);
    expect(await diskFiles()).toBe(1);
  });

  it('no se puede borrar ni reordenar la imagen de otro proyecto', async () => {
    const appfut = await projectId('appfut');
    const other = await projectId('sweet-medical');
    const image = await addImage(appfut);
    expect((await admin.delete(`/projects/${other}/images/${image.body.id}`)).status).toBe(404);
    expect(
      (await admin.put(`/projects/${other}/images/reorder`).send({ ids: [image.body.id] })).status,
    ).toBe(404);
    expect(await db.projectImage.count()).toBe(1);
  });

  it('la imagen de un borrador es privada: solo se ve con sesión', async () => {
    const id = await projectId('appfut');
    await db.project.update({ where: { id }, data: { status: 'DRAFT' } });
    const image = await addImage(id);
    expect(image.body.url).toMatch(/^\/api\/v1\/admin\/files\//);
    const fileId = String(image.body.url).split('/').at(-1);
    expect((await request(ctx.app).get(`/files/${fileId}`)).status).toBe(404);
    expect((await request(ctx.app).get(image.body.url)).status).toBe(401);
    const withSession = await request(ctx.app).get(image.body.url).set('Cookie', admin.cookie);
    expect(withSession.status).toBe(200);
    expect(withSession.headers['cache-control']).toBe('no-store');
    const preview = await admin.get(`/projects/${id}/preview`);
    expect(preview.body.images[0].url).toBe(image.body.url);
  });

  it('la portada se reemplaza y se quita, sin dejar archivos', async () => {
    const id = await projectId('appfut');
    await admin.post(`/projects/${id}/cover`).attach('file', samplePng(), png);
    await admin.post(`/projects/${id}/cover`).attach('file', samplePng(), png);
    expect(await diskFiles()).toBe(1);
    const site = await request(ctx.app).get('/api/v1/public/projects/appfut');
    expect(site.body.coverUrl).toMatch(/^\/files\//);
    expect((await admin.delete(`/projects/${id}/cover`)).status).toBe(204);
    expect(await diskFiles()).toBe(0);
  });

  it('borrar el proyecto borra sus archivos', async () => {
    const id = await projectId('appfut');
    await addImage(id);
    await admin.post(`/projects/${id}/cover`).attach('file', samplePng(), png);
    expect(await diskFiles()).toBe(2);
    await admin.delete(`/projects/${id}`);
    expect(await fileCount()).toBe(0);
    expect(await diskFiles()).toBe(0);
  });
});

describe('CV', () => {
  it('reemplazar la versión vigente cambia lo que se descarga y conserva el historial', async () => {
    const first = await uploadCv('backend', 'primera');
    expect(first.status).toBe(201);
    let download = await request(ctx.app).get('/cv/backend');
    expect(download.body.toString()).toContain('primera');

    await uploadCv('backend', 'segunda');
    download = await request(ctx.app).get('/cv');
    expect(download.body.toString()).toContain('segunda');
    expect(download.headers['content-disposition']).toContain('CV-David-Saghatelyan-Backend.pdf');

    const list = await admin.get('/cv');
    const backend = list.body.profiles.find((p: { profile: string }) => p.profile === 'backend');
    expect(backend.versions).toHaveLength(2);
    expect(list.body.primaryProfile).toBe('backend');
  });

  it('una versión sin marcar como vigente no cambia la descarga, hasta elegirla', async () => {
    await uploadCv('backend', 'vigente');
    const later = await uploadCv('backend', 'nueva', 'false');
    expect((await request(ctx.app).get('/cv/backend')).body.toString()).toContain('vigente');
    const res = await admin.put('/cv/profiles/backend/current').send({ versionId: later.body.id });
    expect(res.status).toBe(204);
    expect((await request(ctx.app).get('/cv/backend')).body.toString()).toContain('nueva');
  });

  it('no acepta como vigente una versión de otro perfil', async () => {
    const other = await uploadCv('soporte', 'soporte');
    const res = await admin.put('/cv/profiles/backend/current').send({ versionId: other.body.id });
    expect(res.status).toBe(409);
  });

  it('el perfil principal define /cv, y exige que el perfil tenga versión vigente', async () => {
    await uploadCv('backend', 'b');
    expect((await admin.put('/cv/primary').send({ profile: 'mainframe' })).status).toBe(409);
    await uploadCv('mainframe', 'm');
    expect((await admin.put('/cv/primary').send({ profile: 'mainframe' })).status).toBe(204);
    const download = await request(ctx.app).get('/cv');
    expect(download.headers['content-disposition']).toContain('Mainframe');
  });

  it('borra una versión anterior con su archivo; la vigente, no', async () => {
    const old = await uploadCv('backend', 'vieja');
    const current = await uploadCv('backend', 'actual');
    expect((await admin.delete(`/cv/versions/${current.body.id}`)).status).toBe(409);
    expect((await admin.delete(`/cv/versions/${old.body.id}`)).status).toBe(204);
    expect(await fileCount()).toBe(1);
    expect(await diskFiles()).toBe(1);
    expect((await request(ctx.app).get('/cv/backend')).status).toBe(200);
  });

  it('una versión anterior se previsualiza con sesión, en línea', async () => {
    const old = await uploadCv('backend', 'anterior');
    await uploadCv('backend', 'actual');
    const path = `/api/v1/admin/cv/versions/${old.body.id}/file`;
    expect((await request(ctx.app).get(path)).status).toBe(401);
    const res = await request(ctx.app).get(path).set('Cookie', admin.cookie);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe('inline');
    expect(res.headers['x-robots-tag']).toBe('noindex');
    expect(res.body.toString()).toContain('anterior');
  });

  it('rechaza un perfil inexistente y una etiqueta vacía', async () => {
    expect((await uploadCv('otro', 'x')).status).toBe(400);
    const empty = await admin
      .post('/cv')
      .field('profile', 'backend')
      .field('label', ' ')
      .attach('file', samplePdf(), pdf);
    expect(empty.status).toBe(400);
  });
});
