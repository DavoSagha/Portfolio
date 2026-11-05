import { createHash } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AdminService } from '../../src/modules/auth/admin.service.js';
import { AuthRepository } from '../../src/modules/auth/auth.repository.js';
import { passwords } from '../../src/modules/auth/passwords.js';
import { createTestApp } from '../helpers/app.js';
import { createTestDb, resetDb } from '../helpers/db.js';

const db = createTestDb();
let ctx: Awaited<ReturnType<typeof createTestApp>>;

const USER = 'admin';
const PASSWORD = 'una-clave-bien-larga';
const HOUR = 60 * 60 * 1000;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

async function signIn(password = PASSWORD) {
  const res = await request(ctx.app).post('/api/v1/auth/login').send({ username: USER, password });
  const token = /sid=([^;]+)/.exec(String(res.headers['set-cookie']))?.[1] ?? '';
  return { res, token, cookie: `sid=${token}`, csrf: res.body.csrfToken as string };
}
const me = (cookie: string) => request(ctx.app).get('/api/v1/auth/me').set('Cookie', cookie);
const sessionOf = (token: string) =>
  db.session.findUniqueOrThrow({ where: { tokenHash: sha256(token) } });
const updateSession = (token: string, data: { lastSeenAt?: Date; expiresAt?: Date }) =>
  db.session.update({ where: { tokenHash: sha256(token) }, data });

beforeAll(async () => {
  ctx = await createTestApp(db);
});
afterAll(async () => {
  await ctx.cleanup();
  await db.$disconnect();
});
beforeEach(async () => {
  await resetDb(db);
  await db.adminUser.create({
    data: { username: USER, passwordHash: await passwords.hash(PASSWORD) },
  });
});

describe('GET /auth/me', () => {
  it('devuelve el usuario y el token CSRF, sin caché', async () => {
    const { cookie, csrf } = await signIn();
    const res = await me(cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ username: USER, csrfToken: csrf });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('responde 401 sin cookie, con un token inventado o con el hash robado de la base', async () => {
    const { token } = await signIn();
    expect((await request(ctx.app).get('/api/v1/auth/me')).status).toBe(401);
    expect((await me('sid=inventado')).status).toBe(401);
    expect((await me(`sid=${sha256(token)}`)).status).toBe(401);
  });
});

describe('expiración', () => {
  it('vence tras 2 horas de inactividad', async () => {
    const { token, cookie } = await signIn();
    await updateSession(token, { lastSeenAt: new Date(Date.now() - 2 * HOUR - 1000) });
    expect((await me(cookie)).status).toBe(401);
  });

  it('la actividad renueva la inactividad', async () => {
    const { token, cookie } = await signIn();
    const before = new Date(Date.now() - HOUR);
    await updateSession(token, { lastSeenAt: before });
    expect((await me(cookie)).status).toBe(200);
    expect((await sessionOf(token)).lastSeenAt.getTime()).toBeGreaterThan(before.getTime());
  });

  it('vence por tiempo absoluto, aunque haya actividad', async () => {
    const { token, cookie } = await signIn();
    await updateSession(token, { expiresAt: new Date(Date.now() - 1000), lastSeenAt: new Date() });
    expect((await me(cookie)).status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  const logout = (cookie?: string, csrf?: string) => {
    const req = request(ctx.app).post('/api/v1/auth/logout');
    if (cookie) void req.set('Cookie', cookie);
    if (csrf) void req.set('X-CSRF-Token', csrf);
    return req;
  };

  it('revoca la sesión en la base y borra la cookie', async () => {
    const { token, cookie, csrf } = await signIn();
    const res = await logout(cookie, csrf);
    expect(res.status).toBe(204);
    expect(String(res.headers['set-cookie'])).toMatch(/^sid=;/);
    expect((await sessionOf(token)).revokedAt).not.toBeNull();
    // Un token copiado antes del logout tampoco sirve.
    expect((await me(cookie)).status).toBe(401);
  });

  it('exige sesión y token CSRF', async () => {
    const { cookie } = await signIn();
    expect((await logout()).status).toBe(401);
    expect((await logout(cookie)).status).toBe(403);
    expect((await logout(cookie, 'token-incorrecto')).status).toBe(403);
    expect((await me(cookie)).status).toBe(200);
  });
});

describe('rutas de administración', () => {
  const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
  const WRITES = ['post', 'put', 'patch', 'delete'] as const;
  // No hay recursos todavía: la barrera está en el router, así que cubre cualquier ruta.
  const PATHS = ['/', '/profile', '/projects', '/projects/1', '/cv', '/no-existe', '/a/b/c'];

  it('responden 401 sin sesión, en cualquier método y ruta, existan o no', async () => {
    for (const method of METHODS) {
      for (const path of PATHS) {
        const res = await request(ctx.app)[method](`/api/v1/admin${path}`);
        expect(res.status, `${method} ${path}`).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHENTICATED');
      }
    }
  });

  it('las escrituras responden 403 sin token CSRF o con el de otra sesión', async () => {
    const { cookie } = await signIn();
    const other = await signIn();
    for (const method of WRITES) {
      const call = () => request(ctx.app)[method]('/api/v1/admin/profile').set('Cookie', cookie);
      const missing = await call();
      expect(missing.status, method).toBe(403);
      expect(missing.body.error.code).toBe('CSRF_INVALID');
      const foreign = await call().set('X-CSRF-Token', other.csrf);
      expect(foreign.status, method).toBe(403);
    }
  });

  it('con sesión y token CSRF pasan las barreras, y no se cachean ni se indexan', async () => {
    const { cookie, csrf } = await signIn();
    const read = await request(ctx.app).get('/api/v1/admin/no-existe').set('Cookie', cookie);
    expect(read.status).toBe(404);
    expect(read.headers['cache-control']).toBe('no-store');
    expect(read.headers['x-robots-tag']).toBe('noindex');
    const write = await request(ctx.app)
      .post('/api/v1/admin/no-existe')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf);
    expect(write.status).toBe(404);
  });
});

describe('límite general por IP en el login', () => {
  it('corta los intentos con usuarios distintos, que el bloqueo por usuario e IP no frena', async () => {
    const limited = await createTestApp(db, { loginRateLimit: { limit: 3, windowMs: 60_000 } });
    const attempt = (username: string) =>
      request(limited.app).post('/api/v1/auth/login').send({ username, password: 'clave-mala' });
    for (const username of ['uno', 'dos', 'tres']) {
      expect((await attempt(username)).status).toBe(401);
    }
    const res = await attempt('cuatro');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    await limited.cleanup();
  });
});

describe('admin:password', () => {
  const service = new AdminService(new AuthRepository(db));
  const NEW_PASSWORD = 'otra-clave-todavia-larga';

  it('cambia la contraseña y revoca todas las sesiones', async () => {
    const a = await signIn();
    const b = await signIn();
    await service.changePassword(NEW_PASSWORD);
    expect((await me(a.cookie)).status).toBe(401);
    expect((await me(b.cookie)).status).toBe(401);
    expect((await signIn(PASSWORD)).res.status).toBe(401);
    expect((await signIn(NEW_PASSWORD)).res.status).toBe(200);
  });

  it('rechaza una contraseña corta sin revocar nada', async () => {
    const { cookie } = await signIn();
    await expect(service.changePassword('corta')).rejects.toMatchObject({ status: 400 });
    expect((await me(cookie)).status).toBe(200);
  });
});

describe('limpieza', () => {
  it('borra lo vencido hace tiempo y conserva las sesiones vigentes', async () => {
    const repo = new AuthRepository(db);
    const active = await signIn();
    const old = await signIn();
    const longAgo = new Date(Date.now() - 48 * HOUR);
    await updateSession(old.token, { expiresAt: longAgo });
    await db.loginThrottle.create({ data: { keyHash: 'viejo', failures: 1, updatedAt: longAgo } });
    await repo.purgeExpired(new Date(Date.now() - 24 * HOUR));
    expect(await db.session.count({ where: { tokenHash: sha256(old.token) } })).toBe(0);
    expect(await db.session.count({ where: { tokenHash: sha256(active.token) } })).toBe(1);
    expect(await db.loginThrottle.count()).toBe(0);
  });
});
