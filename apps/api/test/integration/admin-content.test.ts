import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runSeed } from '../../src/seed/seed.js';
import { adminClient } from '../helpers/admin.js';
import { createTestApp } from '../helpers/app.js';
import { createTestDb, resetDb } from '../helpers/db.js';

const db = createTestDb();
let ctx: Awaited<ReturnType<typeof createTestApp>>;
let admin: Awaited<ReturnType<typeof adminClient>>;

const pub = (path: string) => request(ctx.app).get(`/api/v1/public${path}`);
const projectId = async (slug: string) =>
  (await db.project.findUniqueOrThrow({ where: { slug } })).id;

const FULL_TRANSLATION = {
  title: 'Título nuevo',
  summary: 'Resumen nuevo',
  role: 'Aporte nuevo',
  context: 'Contexto nuevo',
  problem: 'Problema nuevo',
  solution: 'Solución nueva',
  architecture: 'Arquitectura nueva',
  decisions: 'Decisiones nuevas',
  challenges: 'Dificultades nuevas',
  learnings: 'Aprendizajes nuevos',
  limitations: 'Limitaciones nuevas',
  disclaimer: 'Aviso nuevo',
  demoNote: 'Puede tardar en cargar: está en un hosting gratuito.',
};

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

describe('proyectos', () => {
  it('se pueden editar todos los campos públicos, y el sitio los muestra', async () => {
    const id = await projectId('sweet-medical');
    const res = await admin.patch(`/projects/${id}`).send({
      slug: 'sweet-medical-v2',
      status: 'PUBLISHED',
      featured: true,
      inProgress: true,
      team: 'INDIVIDUAL',
      origin: 'PROFESSIONAL',
      startDate: '2026-01-15',
      endDate: '2026-02-20',
      stack: ['Uno', 'Dos'],
      demoUrl: 'https://demo.ejemplo.com',
      repoUrl: 'https://github.com/ejemplo/repo',
      translations: { es: FULL_TRANSLATION },
    });
    expect(res.status).toBe(200);

    const site = await pub('/projects/sweet-medical-v2');
    expect(site.status).toBe(200);
    expect(site.body).toMatchObject({
      featured: true,
      inProgress: true,
      team: 'INDIVIDUAL',
      origin: 'PROFESSIONAL',
      startDate: '2026-01-15',
      endDate: '2026-02-20',
      stack: ['Uno', 'Dos'],
      demoUrl: 'https://demo.ejemplo.com',
      repoUrl: 'https://github.com/ejemplo/repo',
      ...FULL_TRANSLATION,
    });
    expect((await pub('/projects/sweet-medical')).status).toBe(404);
    const home = await pub('/home');
    expect(home.body.featuredProjects.map((p: { slug: string }) => p.slug)).toContain(
      'sweet-medical-v2',
    );
  });

  it('una demo se carga con su aviso, cambia y, al vaciarla, el link y el aviso desaparecen', async () => {
    const id = await projectId('sweet-medical');
    const base = { title: 'Sweet Medical', summary: 'Resumen' };
    await admin.patch(`/projects/${id}`).send({
      demoUrl: 'https://uno.ejemplo.com',
      translations: { es: { ...base, demoNote: 'Hosting gratuito' } },
    });
    let site = await pub('/projects/sweet-medical');
    expect(site.body).toMatchObject({
      demoUrl: 'https://uno.ejemplo.com',
      demoNote: 'Hosting gratuito',
    });

    await admin.patch(`/projects/${id}`).send({ demoUrl: 'https://dos.ejemplo.com' });
    site = await pub('/projects/sweet-medical');
    expect(site.body.demoUrl).toBe('https://dos.ejemplo.com');

    await admin.patch(`/projects/${id}`).send({ demoUrl: '', repoUrl: '' });
    site = await pub('/projects/sweet-medical');
    expect(site.body).toMatchObject({ demoUrl: null, repoUrl: null, demoNote: null });
    // El aviso queda guardado: vuelve a aparecer si se carga otra demo.
    await admin.patch(`/projects/${id}`).send({ demoUrl: 'https://tres.ejemplo.com' });
    expect((await pub('/projects/sweet-medical')).body.demoNote).toBe('Hosting gratuito');
  });

  it('las secciones vaciadas vuelven en null y no se muestran', async () => {
    const id = await projectId('sweet-medical');
    await admin.patch(`/projects/${id}`).send({
      translations: { es: { ...FULL_TRANSLATION, role: '', context: '   ', problem: '' } },
    });
    const site = await pub('/projects/sweet-medical');
    expect(site.body).toMatchObject({ role: null, context: null, problem: null });
  });

  it.each(['javascript:alert(1)', 'data:text/html,x', 'ftp://ejemplo.com', 'no es una url'])(
    'rechaza %s como link: terminaría en un href',
    async (url) => {
      const id = await projectId('sweet-medical');
      for (const field of ['demoUrl', 'repoUrl']) {
        const res = await admin.patch(`/projects/${id}`).send({ [field]: url });
        expect(res.status, field).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        expect(res.body.error.details[0].path).toBe(field);
      }
    },
  );

  it('crea un borrador que el sitio no muestra, y se puede previsualizar', async () => {
    const res = await admin.post('/projects').send({
      slug: 'nuevo',
      translations: { es: { title: 'Nuevo', summary: 'Resumen' } },
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DRAFT');
    expect((await pub('/projects/nuevo')).status).toBe(404);

    const preview = await admin.get(`/projects/${res.body.id}/preview`);
    expect(preview.status).toBe(200);
    expect(preview.body.title).toBe('Nuevo');
    expect(preview.headers['x-robots-tag']).toBe('noindex');

    await admin.patch(`/projects/${res.body.id}`).send({ status: 'PUBLISHED' });
    expect((await pub('/projects/nuevo')).status).toBe(200);
  });

  it('exige título y resumen, y no acepta un slug repetido o inválido', async () => {
    const translations = { es: { title: 'X', summary: 'Y' } };
    expect((await admin.post('/projects').send({ slug: 'x', translations: {} })).status).toBe(400);
    expect(
      (await admin.post('/projects').send({ slug: 'x', translations: { es: { title: 'X' } } }))
        .status,
    ).toBe(400);
    expect((await admin.post('/projects').send({ slug: 'NO VALE', translations })).status).toBe(
      400,
    );
    const repeated = await admin.post('/projects').send({ slug: 'appfut', translations });
    expect(repeated.status).toBe(409);
    expect(JSON.stringify(repeated.body)).not.toContain('Project');
  });

  it('rechaza una fecha de fin anterior a la de inicio', async () => {
    const id = await projectId('sweet-medical');
    const res = await admin
      .patch(`/projects/${id}`)
      .send({ startDate: '2026-03-01', endDate: '2026-01-01' });
    expect(res.status).toBe(400);
  });

  it('no deja escribir campos internos', async () => {
    const id = await projectId('sweet-medical');
    const before = await db.project.findUniqueOrThrow({ where: { id } });
    await admin.patch(`/projects/${id}`).send({ order: 99, createdAt: '2000-01-01', id: 'otro' });
    const after = await db.project.findUniqueOrThrow({ where: { id } });
    expect(after.order).toBe(before.order);
    expect(after.createdAt).toEqual(before.createdAt);
  });

  it('reordena y los destacados del inicio siguen el orden nuevo', async () => {
    const ids = await Promise.all(
      ['formacion-mainframe', 'appfut', 'carta-digital-catedral-del-pisco'].map(projectId),
    );
    expect((await admin.put('/projects/reorder').send({ ids })).status).toBe(204);
    const home = await pub('/home');
    expect(home.body.featuredProjects.map((p: { slug: string }) => p.slug)).toEqual([
      'formacion-mainframe',
      'appfut',
      'carta-digital-catedral-del-pisco',
    ]);
  });

  it('reordenar con un id inexistente responde 404 y no cambia nada', async () => {
    const before = await db.project.findMany({ orderBy: { id: 'asc' } });
    const res = await admin
      .put('/projects/reorder')
      .send({ ids: [before[1]!.id, 'cmw00000000000000000000000'] });
    expect(res.status).toBe(404);
    expect(await db.project.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
  });

  it('el id con formato inválido es 400 y uno inexistente es 404', async () => {
    expect((await admin.get('/projects/NO-VALE')).status).toBe(400);
    const missing = 'cmw00000000000000000000000';
    expect((await admin.get(`/projects/${missing}`)).status).toBe(404);
    expect((await admin.patch(`/projects/${missing}`).send({ featured: true })).status).toBe(404);
    expect((await admin.delete(`/projects/${missing}`)).status).toBe(404);
  });

  it('borra un proyecto', async () => {
    const id = await projectId('sweet-medical');
    expect((await admin.delete(`/projects/${id}`)).status).toBe(204);
    expect((await pub('/projects/sweet-medical')).status).toBe(404);
  });
});

describe('trayectoria', () => {
  const entry = {
    type: 'EXPERIENCE',
    organization: 'Empresa',
    startDate: '2027-01-01',
    translations: { es: { title: 'Puesto', description: 'Tareas' } },
  };

  it('se pueden crear y editar todos los campos públicos', async () => {
    const created = await admin.post('/timeline').send(entry);
    expect(created.status).toBe(201);
    const project = await projectId('appfut');
    const res = await admin.patch(`/timeline/${created.body.id}`).send({
      type: 'CERTIFICATION',
      organization: 'Otra',
      startDate: '2024-02-01',
      endDate: '2024-03-01',
      datePrecision: 'YEAR',
      credentialUrl: 'https://ejemplo.com/credencial',
      relatedProjectId: project,
      translations: { es: { title: 'Certificado', description: 'Detalle' } },
    });
    expect(res.status).toBe(200);
    const site = await pub('/timeline');
    expect(site.body.find((e: { title: string }) => e.title === 'Certificado')).toEqual({
      type: 'CERTIFICATION',
      title: 'Certificado',
      organization: 'Otra',
      startDate: '2024-02-01',
      endDate: '2024-03-01',
      datePrecision: 'YEAR',
      description: 'Detalle',
      credentialUrl: 'https://ejemplo.com/credencial',
      relatedProjectSlug: 'appfut',
    });
  });

  it('ocultar, vaciar el link y reordenar se reflejan en el sitio', async () => {
    const list = await admin.get('/timeline');
    const ids = list.body.map((e: { id: string }) => e.id);
    await admin.put('/timeline/reorder').send({ ids: [...ids].reverse() });
    const site = await pub('/timeline');
    expect(site.body[0].title).toBe(list.body.at(-1).translations.es.title);

    const cert = list.body.find((e: { credentialUrl: string | null }) => e.credentialUrl);
    await admin.patch(`/timeline/${cert.id}`).send({ credentialUrl: '' });
    const after = await pub('/timeline');
    expect(
      after.body.find((e: { title: string }) => e.title === cert.translations.es.title)
        .credentialUrl,
    ).toBeNull();

    await admin.patch(`/timeline/${cert.id}`).send({ published: false });
    const hidden = await pub('/timeline');
    expect(hidden.body).toHaveLength(list.body.length - 1);
  });

  it('valida el link, las fechas y que el proyecto relacionado exista', async () => {
    expect(
      (await admin.post('/timeline').send({ ...entry, credentialUrl: 'javascript:x' })).status,
    ).toBe(400);
    expect((await admin.post('/timeline').send({ ...entry, startDate: 'ayer' })).status).toBe(400);
    expect((await admin.post('/timeline').send({ ...entry, endDate: '2026-01-01' })).status).toBe(
      400,
    );
    expect(
      (
        await admin
          .post('/timeline')
          .send({ ...entry, relatedProjectId: 'cmw00000000000000000000000' })
      ).status,
    ).toBe(409);

    // Una sola fecha también se valida contra la que ya está guardada.
    const created = await admin.post('/timeline').send(entry);
    const patch = await admin.patch(`/timeline/${created.body.id}`).send({ endDate: '2020-01-01' });
    expect(patch.status).toBe(400);
  });

  it('borra una entrada', async () => {
    const created = await admin.post('/timeline').send(entry);
    expect((await admin.delete(`/timeline/${created.body.id}`)).status).toBe(204);
    expect((await admin.get(`/timeline/${created.body.id}`)).status).toBe(404);
  });
});

describe('skills y categorías', () => {
  const firstCategory = async () => (await admin.get('/skill-categories')).body[0].id as string;

  it('editar el nivel, el nombre o el vínculo se ve en el sitio', async () => {
    const skills = await admin.get('/skills');
    const go = skills.body.find((s: { name: string }) => s.name === 'Go');
    const project = await projectId('appfut');
    await admin.patch(`/skills/${go.id}`).send({
      name: 'Golang',
      level: 'SOLID',
      projectIds: [project],
    });
    const site = await pub('/skills');
    const edited = site.body
      .flatMap((c: { skills: unknown[] }) => c.skills)
      .find((s: { name: string }) => s.name === 'Golang');
    expect(edited).toEqual({
      name: 'Golang',
      level: 'SOLID',
      projects: [{ slug: 'appfut', title: 'appFut' }],
    });
  });

  it('una skill sin nivel no se puede publicar', async () => {
    const categoryId = await firstCategory();
    const bad = await admin
      .post('/skills')
      .send({ categoryId, name: 'Nueva', published: true, level: null });
    expect(bad.status).toBe(400);
    const draft = await admin.post('/skills').send({ categoryId, name: 'Nueva' });
    expect(draft.status).toBe(201);
    expect((await admin.patch(`/skills/${draft.body.id}`).send({ published: true })).status).toBe(
      400,
    );
    expect(
      (await admin.patch(`/skills/${draft.body.id}`).send({ published: true, level: 'BASIC' }))
        .status,
    ).toBe(200);
    const published = (await admin.get('/skills')).body.find(
      (s: { name: string }) => s.name === 'Go',
    );
    expect((await admin.patch(`/skills/${published.id}`).send({ level: null })).status).toBe(400);
  });

  it('no repite un nombre en la misma categoría', async () => {
    const skills = await admin.get('/skills');
    const go = skills.body.find((s: { name: string }) => s.name === 'Go');
    const res = await admin.post('/skills').send({ categoryId: go.categoryId, name: 'Go' });
    expect(res.status).toBe(409);
  });

  it('una categoría con skills no se puede borrar; vacía, sí', async () => {
    expect((await admin.delete(`/skill-categories/${await firstCategory()}`)).status).toBe(409);
    const created = await admin
      .post('/skill-categories')
      .send({ translations: { es: { name: 'Vacía' } } });
    expect(created.status).toBe(201);
    expect((await admin.delete(`/skill-categories/${created.body.id}`)).status).toBe(204);
  });

  it('renombrar, ocultar y reordenar categorías se ve en el sitio', async () => {
    const list = (await admin.get('/skill-categories')).body as { id: string }[];
    await admin.put('/skill-categories/reorder').send({ ids: list.map((c) => c.id).reverse() });
    await admin
      .patch(`/skill-categories/${list[0]!.id}`)
      .send({ translations: { es: { name: 'Renombrada' } } });
    const site = await pub('/skills');
    expect(site.body.at(-1).category).toBe('Renombrada');
    await admin.patch(`/skill-categories/${list[0]!.id}`).send({ published: false });
    const hidden = await pub('/skills');
    expect(hidden.body.map((c: { category: string }) => c.category)).not.toContain('Renombrada');
  });

  it('reordena skills y las borra', async () => {
    const skills = (await admin.get('/skills')).body as { id: string; name: string }[];
    const backend = skills.slice(0, 2).map((s) => s.id);
    await admin.put('/skills/reorder').send({ ids: backend.reverse() });
    const site = await pub('/skills');
    expect(site.body[0].skills[0].name).toBe(skills[1]!.name);
    expect((await admin.delete(`/skills/${skills[0]!.id}`)).status).toBe(204);
  });
});

describe('idiomas', () => {
  it('CRUD, orden y publicación', async () => {
    const created = await admin
      .post('/languages')
      .send({ code: 'pt', level: 'A2', translations: { es: { name: 'Portugués' } } });
    expect(created.status).toBe(201);
    expect((await pub('/languages')).body.at(-1)).toEqual({
      code: 'pt',
      level: 'A2',
      name: 'Portugués',
    });
    await admin.patch(`/languages/${created.body.id}`).send({ level: 'B1' });
    expect((await pub('/languages')).body.at(-1).level).toBe('B1');

    const ids = (await admin.get('/languages')).body.map((l: { id: string }) => l.id);
    await admin.put('/languages/reorder').send({ ids: [...ids].reverse() });
    expect((await pub('/languages')).body[0].code).toBe('pt');

    await admin.patch(`/languages/${created.body.id}`).send({ published: false });
    expect((await pub('/languages')).body.map((l: { code: string }) => l.code)).not.toContain('pt');
    expect((await admin.delete(`/languages/${created.body.id}`)).status).toBe(204);
  });

  it('rechaza un nivel inválido y un código repetido', async () => {
    const translations = { es: { name: 'X' } };
    expect(
      (await admin.post('/languages').send({ code: 'xx', level: 'Z9', translations })).status,
    ).toBe(400);
    expect(
      (await admin.post('/languages').send({ code: 'es', level: 'B1', translations })).status,
    ).toBe(409);
  });
});

describe('perfil', () => {
  const profile = {
    fullName: 'Nombre Nuevo',
    location: 'Otro lugar',
    linkedinUrl: 'https://www.linkedin.com/in/otro',
    githubUrl: '',
    publicEmail: 'otro@ejemplo.com',
    showEmail: true,
    translations: {
      es: { headline: 'Titular', valueProp: 'Frase', summary: 'Resumen', availability: 'Ya' },
    },
  };

  it('se puede editar y el sitio lo muestra', async () => {
    expect((await admin.put('/profile').send(profile)).status).toBe(200);
    const site = await pub('/home');
    expect(site.body.profile).toMatchObject({
      fullName: 'Nombre Nuevo',
      location: 'Otro lugar',
      headline: 'Titular',
      valueProp: 'Frase',
      summary: 'Resumen',
      availability: 'Ya',
      linkedinUrl: 'https://www.linkedin.com/in/otro',
      githubUrl: null,
      publicEmail: 'otro@ejemplo.com',
    });
  });

  it('ocultar el email lo saca del sitio, y valida email y links', async () => {
    await admin.put('/profile').send({ ...profile, showEmail: false });
    expect((await pub('/home')).body.profile.publicEmail).toBeNull();
    const badEmail = await admin.put('/profile').send({ ...profile, publicEmail: 'no-es-email' });
    expect(badEmail.status).toBe(400);
    const badLink = await admin.put('/profile').send({ ...profile, githubUrl: 'javascript:x' });
    expect(badLink.status).toBe(400);
    const noHeadline = await admin
      .put('/profile')
      .send({ ...profile, translations: { es: { headline: '' } } });
    expect(noHeadline.status).toBe(400);
  });
});
