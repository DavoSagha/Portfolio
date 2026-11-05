import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Router } from 'express';
import type { FilesController } from '../../src/modules/files/files.controller.js';
import type { AdminController } from '../../src/modules/admin/admin.controller.js';
import { adminRoutes } from '../../src/modules/admin/admin.routes.js';
import type { AdminService } from '../../src/modules/admin/admin.service.js';
import { adminClient } from '../helpers/admin.js';
import { createTestApp } from '../helpers/app.js';
import { createTestDb, resetDb } from '../helpers/db.js';

const db = createTestDb();
let ctx: Awaited<ReturnType<typeof createTestApp>>;

/** Dobles que solo sirven para registrar las rutas: acá no se ejecuta ningún handler. */
const noop = () => undefined;
const stub = new Proxy({}, { get: () => stub2 });
const stub2 = new Proxy(noop, { get: () => noop });

/** Todas las rutas registradas en el router del panel: una ruta nueva entra sola en la prueba. */
function registeredRoutes(router: Router) {
  const routes: { method: 'get' | 'post' | 'put' | 'patch' | 'delete'; path: string }[] = [];
  for (const layer of router.stack) {
    if (!layer.route) continue;
    const { path, methods } = layer.route as unknown as {
      path: string;
      methods: Record<string, boolean>;
    };
    for (const method of Object.keys(methods)) {
      if (method === '_all') continue;
      routes.push({
        method: method as 'get',
        path: path.replace(/:[a-zA-Z]+/g, (param) =>
          param === ':profile' ? 'backend' : 'cmw00000000000000000000000',
        ),
      });
    }
  }
  return routes;
}

const routes = registeredRoutes(
  adminRoutes(
    stub as unknown as AdminController,
    stub as unknown as AdminService,
    stub as unknown as FilesController,
  ),
);
const writes = routes.filter((route) => route.method !== 'get');

beforeAll(async () => {
  ctx = await createTestApp(db);
});
afterAll(async () => {
  await ctx.cleanup();
  await db.$disconnect();
});
beforeEach(() => resetDb(db));

describe('todas las rutas del panel', () => {
  it('el recorrido encuentra las rutas', () => {
    expect(routes.length).toBeGreaterThan(40);
    expect(writes.length).toBeGreaterThan(20);
  });

  it('responden 401 sin sesión', async () => {
    for (const { method, path } of routes) {
      const res = await request(ctx.app)[method](`/api/v1/admin${path}`);
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });

  it('las escrituras responden 403 sin token CSRF', async () => {
    const admin = await adminClient(ctx.app, db);
    for (const { method, path } of writes) {
      const call = request(ctx.app)[method](`/api/v1/admin${path}`);
      const res = await call.set('Cookie', admin.cookie);
      expect(res.status, `${method} ${path}`).toBe(403);
      expect(res.body.error.code).toBe('CSRF_INVALID');
    }
  });

  it('no se cachean ni se indexan', async () => {
    const admin = await adminClient(ctx.app, db);
    for (const { method, path } of routes.filter((route) => route.method === 'get')) {
      const res = await admin.get(path);
      expect(res.headers['cache-control'], `${method} ${path}`).toBe('no-store');
      expect(res.headers['x-robots-tag'], `${method} ${path}`).toBe('noindex');
    }
  });
});
