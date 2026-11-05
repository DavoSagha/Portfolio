import request from 'supertest';
import type { Express } from 'express';
import type { Db } from '../../src/db/client.js';
import { passwords } from '../../src/modules/auth/passwords.js';

const USER = 'admin';
const PASSWORD = 'una-clave-bien-larga';

/** Crea un administrador, inicia sesión y devuelve un cliente con cookie y token CSRF. */
export async function adminClient(app: Express, db: Db) {
  await db.adminUser.create({
    data: { username: USER, passwordHash: await passwords.hash(PASSWORD) },
  });
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ username: USER, password: PASSWORD });
  const cookie = /sid=[^;]+/.exec(String(login.headers['set-cookie']))?.[0] ?? '';
  const csrf = login.body.csrfToken as string;
  const write = (method: 'post' | 'put' | 'patch' | 'delete', path: string) =>
    request(app)[method](`/api/v1/admin${path}`).set('Cookie', cookie).set('X-CSRF-Token', csrf);
  return {
    cookie,
    csrf,
    get: (path: string) => request(app).get(`/api/v1/admin${path}`).set('Cookie', cookie),
    post: (path: string) => write('post', path),
    put: (path: string) => write('put', path),
    patch: (path: string) => write('patch', path),
    delete: (path: string) => write('delete', path),
  };
}
