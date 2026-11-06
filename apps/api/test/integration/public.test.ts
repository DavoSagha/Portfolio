import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runSeed } from '../../src/seed/seed.js';
import { createTestApp } from '../helpers/app.js';
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

describe('API pública sin contenido', () => {
  beforeEach(() => resetDb(db));

  it('home responde 404 si el perfil no fue cargado', async () => {
    const res = await request(ctx.app).get('/api/v1/public/home');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('las listas vacías responden 200 con []', async () => {
    for (const path of ['projects', 'timeline', 'skills', 'languages']) {
      const res = await request(ctx.app).get(`/api/v1/public/${path}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    }
  });
});

describe('API pública con el contenido del seed', () => {
  beforeAll(async () => {
    await resetDb(db);
    await runSeed(db);
  });

  it('home devuelve perfil, destacados en orden y secciones', async () => {
    const res = await request(ctx.app).get('/api/v1/public/home');
    expect(res.status).toBe(200);
    expect(res.body.locale).toBe('es');
    expect(res.body.availableLocales).toEqual(['es']);
    expect(res.body.profile.fullName).toBe('David Saghatelyan');
    expect(res.body.profile).toMatchObject({
      headline: 'Desarrollador Backend Jr | JavaScript, TypeScript, Go, COBOL',
      location: 'CABA, Argentina',
      publicEmail: 'saghatelyandsm@gmail.com',
    });
    expect(res.body.cv).toEqual({ primaryUrl: null, profiles: [] });
    expect(res.body.featuredProjects.map((p: { slug: string }) => p.slug)).toEqual([
      'appfut',
      'carta-digital-catedral-del-pisco',
      'formacion-mainframe',
    ]);
    const all = await request(ctx.app).get('/api/v1/public/projects');
    expect(all.body).toHaveLength(5);
    expect(res.body.sections).toEqual({
      projects: true,
      timeline: true,
      skills: true,
      languages: true,
      contact: true,
    });
  });

  it('muestra el email solo si está habilitado', async () => {
    await db.profile.update({ where: { id: 1 }, data: { showEmail: false } });
    const res = await request(ctx.app).get('/api/v1/public/home');
    expect(res.body.profile.publicEmail).toBeNull();
    await db.profile.update({ where: { id: 1 }, data: { showEmail: true } });
  });

  it('el detalle de proyecto incluye las secciones; un borrador responde 404', async () => {
    const ok = await request(ctx.app).get('/api/v1/public/projects/appfut');
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({
      slug: 'appfut',
      team: 'GROUP',
      origin: 'PERSONAL',
      inProgress: true,
      title: 'appFut',
      repoUrl: 'https://github.com/DavoSagha/appfut',
      demoUrl: null,
    });
    expect(ok.body.stack).toContain('Supabase (Postgres, Auth, Storage, RLS)');
    // Las secciones sin contenido confirmado vuelven en null y la web no las muestra.
    expect(ok.body.learnings).toBeNull();

    await db.project.update({ where: { slug: 'appfut' }, data: { status: 'DRAFT' } });
    expect((await request(ctx.app).get('/api/v1/public/projects/appfut')).status).toBe(404);
    const list = await request(ctx.app).get('/api/v1/public/projects');
    expect(list.body.map((p: { slug: string }) => p.slug)).not.toContain('appfut');
    await db.project.update({ where: { slug: 'appfut' }, data: { status: 'PUBLISHED' } });
  });

  it('un slug con formato inválido es un error de validación', async () => {
    const res = await request(ctx.app).get('/api/v1/public/projects/NO_VALIDO');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('las skills publicadas incluyen su nivel y los proyectos publicados que las usan', async () => {
    const res = await request(ctx.app).get('/api/v1/public/skills');
    const categories = res.body.map((c: { category: string }) => c.category);
    expect(categories.at(-1)).toBe('Contenido y diseño');
    const go = res.body
      .flatMap((c: { skills: unknown[] }) => c.skills)
      .find((s: { name: string }) => s.name === 'Go');
    expect(go).toEqual({
      name: 'Go',
      level: 'INTERMEDIATE',
      projects: [{ slug: 'simulador-sistema-operativo', title: 'Simulador de sistema operativo' }],
    });

    await db.skill.updateMany({ where: { name: 'Go' }, data: { published: false } });
    const hidden = await request(ctx.app).get('/api/v1/public/skills');
    expect(JSON.stringify(hidden.body)).not.toContain('"Go"');
    await db.skill.updateMany({ where: { name: 'Go' }, data: { published: true } });
  });

  it('la carta digital lleva el aviso de no afiliación y no muestra un aporte vacío', async () => {
    const res = await request(ctx.app).get(
      '/api/v1/public/projects/carta-digital-catedral-del-pisco',
    );
    expect(res.status).toBe(200);
    expect(res.body.disclaimer).toMatch(/no tiene afiliación con La Catedral del Pisco/);
    expect(res.body.role).toBeNull();
  });

  it('las secciones verificadas se publican y las que escribe el autor quedan ocultas', async () => {
    const carta = await request(ctx.app).get(
      '/api/v1/public/projects/carta-digital-catedral-del-pisco',
    );
    expect(carta.body.architecture).toMatch(/Gemini/);
    expect(carta.body).toMatchObject({ problem: null, challenges: null, learnings: null });

    const appfut = await request(ctx.app).get('/api/v1/public/projects/appfut');
    expect(appfut.body.solution).toMatch(/entran a la reserva/);
    expect(appfut.body).toMatchObject({ learnings: null, limitations: null });
  });

  it('la trayectoria se ordena por fecha descendente y vincula la certificación COBOL', async () => {
    const res = await request(ctx.app).get('/api/v1/public/timeline');
    const dates = res.body.map((e: { startDate: string }) => e.startDate);
    expect(dates).toEqual([...dates].sort().reverse());
    const cobol = res.body.find((e: { title: string }) => e.title.includes('COBOL'));
    expect(cobol).toMatchObject({
      type: 'CERTIFICATION',
      relatedProjectSlug: 'formacion-mainframe',
      credentialUrl: expect.stringMatching(/^https:\/\/drive\.google\.com\/file\/d\/1fk_/),
    });
    const fullStack = res.body.find((e: { title: string }) => e.title.includes('Full Stack'));
    expect(fullStack.credentialUrl).toMatch(/^https:\/\/drive\.google\.com\/file\/d\/13-pi/);
  });

  it('usa la traducción pedida y, si no existe, la de español', async () => {
    await db.languageTranslation.create({
      data: {
        languageId: (await db.language.findUniqueOrThrow({ where: { code: 'fr' } })).id,
        locale: 'en',
        name: 'French',
      },
    });
    const en = await request(ctx.app).get('/api/v1/public/languages?locale=en');
    expect(en.body.find((l: { code: string }) => l.code === 'fr').name).toBe('French');
    expect(en.body.find((l: { code: string }) => l.code === 'ru').name).toBe('Ruso');
    const invalid = await request(ctx.app).get('/api/v1/public/languages?locale=de');
    expect(invalid.status).toBe(400);
  });
});

describe('HTTP', () => {
  it('rutas inexistentes responden 404 en JSON y con cabeceras de seguridad', async () => {
    const res = await request(ctx.app).get('/api/v1/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('no habilita CORS para otros orígenes', async () => {
    const res = await request(ctx.app)
      .get('/api/v1/public/projects')
      .set('Origin', 'https://otro-sitio.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('health verifica la conexión a la base', async () => {
    const res = await request(ctx.app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
