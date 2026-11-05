import { createHash } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthRepository } from '../../src/modules/auth/auth.repository.js';
import { LoginThrottle } from '../../src/modules/auth/login-throttle.js';
import { passwords } from '../../src/modules/auth/passwords.js';
import { createTestApp } from '../helpers/app.js';
import { createTestDb, resetDb } from '../helpers/db.js';

/*
 * Criterios de aceptación de POST /auth/login. Prueban el comportamiento desde afuera,
 * sin asumir cómo está escrito.
 */
const db = createTestDb();
let ctx: Awaited<ReturnType<typeof createTestApp>>;

const URL = '/api/v1/auth/login';
const USER = 'admin';
const PASSWORD = 'una-clave-bien-larga';
const IP = '203.0.113.10';

const login = (body: object, ip = IP) =>
  request(ctx.app).post(URL).set('X-Forwarded-For', ip).send(body);
const wrong = (username = USER, ip = IP) => login({ username, password: 'clave-incorrecta' }, ip);
const sidOf = (res: request.Response) =>
  /sid=([^;]+)/.exec(String(res.headers['set-cookie']))?.[1] ?? '';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

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
afterEach(() => vi.restoreAllMocks());

describe('login correcto', () => {
  it('responde 200 con el token CSRF y una cookie protegida', async () => {
    const res = await login({ username: USER, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ csrfToken: expect.any(String) });
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/^sid=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=604800/);
  });

  it('la base guarda el hash del token, no el token', async () => {
    const res = await login({ username: USER, password: PASSWORD });
    const token = sidOf(res);
    const session = await db.session.findFirstOrThrow();
    expect(session.tokenHash).toBe(sha256(token));
    expect(session.tokenHash).not.toBe(token);
    expect(session.csrfToken).toBe(res.body.csrfToken);
  });

  it('limpia los fallos acumulados', async () => {
    for (let i = 0; i < 4; i++) await wrong();
    expect((await login({ username: USER, password: PASSWORD })).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await wrong()).status).toBe(401);
    expect((await login({ username: USER, password: PASSWORD })).status).toBe(200);
  });
});

describe('enumeración de usuarios', () => {
  it('contraseña incorrecta y usuario inexistente responden exactamente igual', async () => {
    const badPassword = await wrong();
    const noUser = await wrong('no-existe');
    expect(badPassword.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(noUser.body).toEqual(badPassword.body);
    expect(badPassword.body.error.code).toBe('UNAUTHENTICATED');
    expect(badPassword.headers['set-cookie']).toBeUndefined();
  });

  it('Argon2 corre también si el usuario no existe, para no delatarlo por el tiempo', async () => {
    const verify = vi.spyOn(passwords, 'verify');
    await wrong('no-existe');
    expect(verify).toHaveBeenCalledTimes(1);
  });
});

describe('validación de la entrada', () => {
  it.each([
    ['sin campos', {}],
    ['sin contraseña', { username: USER }],
    ['sin usuario', { password: PASSWORD }],
    ['usuario vacío', { username: '', password: PASSWORD }],
    ['contraseña vacía', { username: USER, password: '' }],
    ['usuario que no es texto', { username: { $ne: '' }, password: PASSWORD }],
    ['contraseña que no es texto', { username: USER, password: ['a'] }],
    ['usuario enorme', { username: 'a'.repeat(1000), password: PASSWORD }],
    ['contraseña enorme', { username: USER, password: 'a'.repeat(10_000) }],
  ])('%s: 400 sin llegar a Argon2', async (_name, body) => {
    const verify = vi.spyOn(passwords, 'verify');
    const res = await login(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(verify).not.toHaveBeenCalled();
  });

  it('un error de validación no devuelve la contraseña', async () => {
    const res = await login({ username: 1, password: 'secreto-que-no-vuelve' });
    expect(JSON.stringify(res.body)).not.toContain('secreto-que-no-vuelve');
  });
});

describe('fuerza bruta', () => {
  const lock = async (username = USER, ip = IP) => {
    for (let i = 0; i < 5; i++) expect((await wrong(username, ip)).status).toBe(401);
  };

  it('tras 5 fallos responde 429 con Retry-After, aun con la contraseña correcta', async () => {
    await lock();
    const res = await login({ username: USER, password: PASSWORD });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('con el bloqueo activo no gasta CPU en Argon2', async () => {
    await lock();
    const verify = vi.spyOn(passwords, 'verify');
    await wrong();
    expect(verify).not.toHaveBeenCalled();
  });

  it('también bloquea a un usuario inexistente, para no delatar cuáles existen', async () => {
    await lock('no-existe');
    expect((await wrong('no-existe')).status).toBe(429);
  });

  it('cambiar mayúsculas del usuario no reinicia la cuenta', async () => {
    for (const username of ['admin', 'ADMIN', 'Admin', 'aDmin', ' admin ']) await wrong(username);
    expect((await wrong()).status).toBe(429);
  });

  it('no bloquea al mismo usuario desde otra IP ni a otro usuario desde la misma IP', async () => {
    await lock();
    expect((await login({ username: USER, password: PASSWORD }, '203.0.113.99')).status).toBe(200);
    expect((await wrong('otro')).status).toBe(401);
  });

  it('un X-Forwarded-For falsificado no evade el bloqueo: vale el salto agregado por Caddy', async () => {
    await lock();
    const res = await login({ username: USER, password: PASSWORD }, `198.51.100.7, ${IP}`);
    expect(res.status).toBe(429);
  });

  it('al vencer el bloqueo se puede volver a entrar', async () => {
    await lock();
    const key = new LoginThrottle(new AuthRepository(db)).keyFor(USER, IP);
    await db.loginThrottle.update({
      where: { keyHash: key },
      data: { lockedUntil: new Date(Date.now() - 1000) },
    });
    expect((await login({ username: USER, password: PASSWORD })).status).toBe(200);
  });
});

describe('fijación de sesión', () => {
  it('un login nuevo crea otro token y revoca la sesión de la cookie anterior', async () => {
    const first = sidOf(await login({ username: USER, password: PASSWORD }));
    const res = await login({ username: USER, password: PASSWORD }).set('Cookie', `sid=${first}`);
    const second = sidOf(res);
    expect(res.status).toBe(200);
    expect(second).not.toBe(first);
    const old = await db.session.findUniqueOrThrow({ where: { tokenHash: sha256(first) } });
    const current = await db.session.findUniqueOrThrow({ where: { tokenHash: sha256(second) } });
    expect(old.revokedAt).not.toBeNull();
    expect(current.revokedAt).toBeNull();
  });
});
