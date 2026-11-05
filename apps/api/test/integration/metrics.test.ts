import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { VisitorHasher, normalizeRef } from '../../src/modules/metrics/event-recorder.js';
import { MetricsRepository } from '../../src/modules/metrics/metrics.repository.js';
import { eventRetentionCutoff } from '../../src/modules/metrics/metrics.service.js';
import { runSeed } from '../../src/seed/seed.js';
import { adminClient } from '../helpers/admin.js';
import { createTestApp, samplePdf } from '../helpers/app.js';
import { createTestDb, resetDb } from '../helpers/db.js';

const db = createTestDb();
let ctx: Awaited<ReturnType<typeof createTestApp>>;
let admin: Awaited<ReturnType<typeof adminClient>>;

const IP = '203.0.113.20';
const pageView = { type: 'PAGE_VIEW', path: '/proyectos', ref: 'linkedin' };
const post = (body: object) =>
  request(ctx.app).post('/api/v1/public/events').set('X-Forwarded-For', IP).send(body);
const uploadCv = async (profile = 'backend', makeCurrent = 'true') =>
  (
    await admin
      .post('/cv')
      .field('profile', profile)
      .field('label', `Versión ${profile}`)
      .field('makeCurrent', makeCurrent)
      .attach('file', samplePdf(profile), { filename: 'cv.pdf', contentType: 'application/pdf' })
  ).body.id as string;

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

describe('POST /public/events', () => {
  it('guarda el evento sin la IP ni el user-agent en crudo', async () => {
    const res = await post(pageView).set('User-Agent', 'Navegador/1.0');
    expect(res.status).toBe(204);
    const event = await db.event.findFirstOrThrow();
    expect(event).toMatchObject({ type: 'PAGE_VIEW', path: '/proyectos', ref: 'linkedin' });
    expect(event.visitorHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify({ ...event, id: 0 })).not.toContain(IP);
    expect(JSON.stringify({ ...event, id: 0 })).not.toContain('Navegador');
  });

  it('normaliza el origen a minúsculas', async () => {
    await post({ ...pageView, ref: 'LinkedIn' });
    expect((await db.event.findFirstOrThrow()).ref).toBe('linkedin');
  });

  it.each([
    ['un tipo que registra solo el servidor', { type: 'CV_DOWNLOAD' }],
    ['otro servidor de contacto', { type: 'CONTACT_SUBMIT' }],
    ['un tipo inexistente', { type: 'OTRO' }],
    ['una ruta sin barra', { path: 'proyectos' }],
    ['una ruta con query string', { path: '/proyectos?email=a@b.com' }],
    ['una ruta larga', { path: `/${'a'.repeat(200)}` }],
    ['un origen con símbolos', { ref: '<script>' }],
    ['un origen largo', { ref: 'a'.repeat(51) }],
    ['un destino inválido', { targetId: '../../etc' }],
  ])('rechaza %s, sin guardar', async (_label, change) => {
    expect((await post({ ...pageView, ...change })).status).toBe(400);
    expect(await db.event.count()).toBe(0);
  });

  it('no registra las rutas privadas', async () => {
    for (const path of ['/admin', '/admin/proyectos', '/api/v1/health']) {
      expect((await post({ type: 'PAGE_VIEW', path })).status).toBe(204);
    }
    expect(await db.event.count()).toBe(0);
  });

  it('con sesión de admin responde 204 y no registra nada', async () => {
    const res = await post(pageView).set('Cookie', admin.cookie);
    expect(res.status).toBe(204);
    expect(await db.event.count()).toBe(0);
  });

  it('una sesión vencida, revocada o inventada vuelve a contar', async () => {
    await post(pageView).set('Cookie', 'sid=inventada');
    expect(await db.event.count()).toBe(1);

    await db.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await post(pageView).set('Cookie', admin.cookie);
    expect(await db.event.count()).toBe(2);
  });

  it('registrar eventos no prolonga la sesión', async () => {
    const before = new Date(Date.now() - 60 * 60 * 1000);
    await db.session.updateMany({ data: { lastSeenAt: before } });
    await post(pageView).set('Cookie', admin.cookie);
    expect((await db.session.findFirstOrThrow()).lastSeenAt).toEqual(before);
  });

  it('limita las solicitudes por IP', async () => {
    const limited = await createTestApp(db, {
      rateLimits: { events: { limit: 2, windowMs: 60_000 } },
    });
    const send = () => request(limited.app).post('/api/v1/public/events').send(pageView);
    expect((await send()).status).toBe(204);
    expect((await send()).status).toBe(204);
    const blocked = await send();
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(await db.event.count()).toBe(2);
    await limited.cleanup();
  });
});

describe('descargas de CV', () => {
  it('registran la versión descargada y el origen', async () => {
    const versionId = await uploadCv();
    await request(ctx.app).get('/cv/backend?ref=LinkedIn').expect(200);
    expect(await db.event.findFirstOrThrow()).toMatchObject({
      type: 'CV_DOWNLOAD',
      path: '/cv/backend',
      ref: 'linkedin',
      targetId: versionId,
    });
  });

  it('un origen inválido se ignora y la descarga funciona igual', async () => {
    await uploadCv();
    await request(ctx.app).get('/cv?ref=%3Cscript%3E').expect(200);
    expect((await db.event.findFirstOrThrow()).ref).toBeNull();
  });

  it('con sesión de admin, y en un HEAD, no se registran', async () => {
    await uploadCv();
    await request(ctx.app).get('/cv').set('Cookie', admin.cookie).expect(200);
    await request(ctx.app).head('/cv').expect(200);
    expect(await db.event.count()).toBe(0);
  });

  it('un CV inexistente no registra nada', async () => {
    await request(ctx.app).get('/cv/soporte').expect(404);
    expect(await db.event.count()).toBe(0);
  });
});

describe('contacto y métricas', () => {
  const message = { name: 'Ana', email: 'ana@ejemplo.com', message: 'Un mensaje de prueba.' };

  it('un envío registra CONTACT_SUBMIT, salvo con sesión de admin', async () => {
    await request(ctx.app).post('/api/v1/public/contact').send(message).expect(202);
    expect((await db.event.findFirstOrThrow()).type).toBe('CONTACT_SUBMIT');
    await request(ctx.app)
      .post('/api/v1/public/contact')
      .set('Cookie', admin.cookie)
      .send(message)
      .expect(202);
    expect(await db.event.count()).toBe(1);
    expect(await db.contactMessage.count()).toBe(2);
  });
});

describe('VisitorHasher', () => {
  const day = (date: string) => new Date(`${date}T12:00:00Z`);

  it('es estable en el día y cambia al cambiar el día', () => {
    const hasher = new VisitorHasher();
    const first = hasher.hash(IP, 'ua', day('2026-11-05'));
    expect(hasher.hash(IP, 'ua', day('2026-11-05'))).toBe(first);
    expect(hasher.hash('203.0.113.21', 'ua', day('2026-11-05'))).not.toBe(first);
    expect(hasher.hash(IP, 'otro', day('2026-11-05'))).not.toBe(first);
    expect(hasher.hash(IP, 'ua', day('2026-11-06'))).not.toBe(first);
  });

  it('dos procesos no generan el mismo hash: la sal no se deriva de los datos', () => {
    const now = day('2026-11-05');
    expect(new VisitorHasher().hash(IP, 'ua', now)).not.toBe(
      new VisitorHasher().hash(IP, 'ua', now),
    );
  });
});

describe('normalizeRef', () => {
  it('acepta solo el patrón permitido', () => {
    expect(normalizeRef(' LinkedIn ')).toBe('linkedin');
    expect(normalizeRef('mi_ref-1')).toBe('mi_ref-1');
    expect(normalizeRef('a b')).toBeNull();
    expect(normalizeRef(['a'])).toBeNull();
    expect(normalizeRef(undefined)).toBeNull();
  });
});

describe('retención de eventos', () => {
  it('el corte son 12 meses calendario', () => {
    expect(eventRetentionCutoff(new Date('2026-11-05T12:00:00Z')).toISOString()).toBe(
      '2025-11-05T12:00:00.000Z',
    );
  });

  it('borra solo lo anterior al corte, y nunca toca los mensajes', async () => {
    const event = (createdAt: string) =>
      db.event.create({
        data: { type: 'PAGE_VIEW', path: '/', visitorHash: 'h', createdAt: new Date(createdAt) },
      });
    const oldMessage = await db.contactMessage.create({
      data: {
        name: 'Ana',
        email: 'ana@ejemplo.com',
        body: 'Un mensaje viejo',
        createdAt: new Date('2020-01-01T00:00:00Z'),
      },
    });
    await event('2025-11-05T11:59:59Z');
    await event('2025-11-05T12:00:00Z');
    await event('2026-11-05T11:00:00Z');

    const repo = new MetricsRepository(db);
    const cutoff = eventRetentionCutoff(new Date('2026-11-05T12:00:00Z'));
    expect(await repo.deleteEventsBefore(cutoff)).toBe(1);
    expect(await db.event.count()).toBe(2);
    expect(await db.contactMessage.findUnique({ where: { id: oldMessage.id } })).not.toBeNull();
  });
});

describe('panel de métricas', () => {
  const event = (data: {
    type: 'PAGE_VIEW' | 'CV_DOWNLOAD' | 'PROJECT_CLICK' | 'CONTACT_SUBMIT';
    path?: string;
    ref?: string;
    targetId?: string;
    visitorHash?: string;
    createdAt: string;
  }) =>
    db.event.create({
      data: {
        path: '/',
        visitorHash: 'hash',
        ...data,
        createdAt: new Date(data.createdAt),
      },
    });

  it('resume el período por tipo, origen, página, proyecto y versión de CV', async () => {
    const versionId = await uploadCv();
    const at = '2026-03-10T15:00:00Z';
    await event({ type: 'PAGE_VIEW', path: '/', ref: 'linkedin', visitorHash: 'a', createdAt: at });
    await event({ type: 'PAGE_VIEW', path: '/', ref: 'linkedin', visitorHash: 'a', createdAt: at });
    await event({ type: 'PAGE_VIEW', path: '/proyectos', visitorHash: 'b', createdAt: at });
    // El mismo hash en otro día cuenta otra vez: es una suma de únicos diarios.
    await event({ type: 'PAGE_VIEW', visitorHash: 'a', createdAt: '2026-03-11T15:00:00Z' });
    await event({ type: 'CV_DOWNLOAD', ref: 'linkedin', targetId: versionId, createdAt: at });
    await event({ type: 'CV_DOWNLOAD', targetId: 'cmw00000000000000000000000', createdAt: at });
    await event({ type: 'PROJECT_CLICK', targetId: 'appfut', createdAt: at });
    await event({ type: 'PROJECT_CLICK', targetId: 'no-existe', createdAt: at });
    await event({ type: 'CONTACT_SUBMIT', createdAt: at });
    // Fuera del período: no se cuenta.
    await event({ type: 'PAGE_VIEW', createdAt: '2026-03-12T00:00:00Z' });

    const res = await admin.get('/metrics/summary?from=2026-03-10&to=2026-03-11');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      pageViews: 4,
      uniqueVisitors: 3,
      cvDownloads: 2,
      projectClicks: 2,
      contactSubmits: 1,
      byRef: [{ ref: 'linkedin', pageViews: 2, cvDownloads: 1 }],
      topPages: [
        { path: '/', views: 3 },
        { path: '/proyectos', views: 1 },
      ],
      topProjects: [{ slug: 'appfut', title: 'appFut', clicks: 1 }],
    });
    expect(res.body.byCvVersion).toEqual(
      expect.arrayContaining([
        { profile: 'backend', versionId, label: 'Versión backend', downloads: 1 },
        {
          profile: null,
          versionId: 'cmw00000000000000000000000',
          label: null,
          downloads: 1,
        },
      ]),
    );
  });

  it('la serie diaria completa los días sin eventos', async () => {
    await event({ type: 'PAGE_VIEW', createdAt: '2026-03-10T23:59:00Z' });
    await event({ type: 'PAGE_VIEW', createdAt: '2026-03-12T00:00:00Z' });
    await event({ type: 'CV_DOWNLOAD', createdAt: '2026-03-10T10:00:00Z' });
    const res = await admin.get('/metrics/timeseries?type=PAGE_VIEW&from=2026-03-10&to=2026-03-12');
    expect(res.body).toEqual([
      { date: '2026-03-10', count: 1 },
      { date: '2026-03-11', count: 0 },
      { date: '2026-03-12', count: 1 },
    ]);
  });

  it('por defecto muestra los últimos 30 días', async () => {
    const res = await admin.get('/metrics/timeseries');
    expect(res.body).toHaveLength(30);
    expect(res.body.at(-1).date).toBe(new Date().toISOString().slice(0, 10));
  });

  it('valida el rango', async () => {
    expect((await admin.get('/metrics/summary?from=ayer')).status).toBe(400);
    expect((await admin.get('/metrics/summary?from=2026-03-11&to=2026-03-10')).status).toBe(400);
    expect((await admin.get('/metrics/summary?from=2020-01-01&to=2026-01-01')).status).toBe(400);
    expect((await admin.get('/metrics/timeseries?type=OTRO')).status).toBe(400);
  });
});
