import { expect, test } from '@playwright/test';

/* Lo que solo se puede comprobar a través de Caddy: Supertest no pasa por el proxy. */

test('un X-Forwarded-For inventado no evade el bloqueo del login', async ({ request }) => {
  // Un usuario distinto en cada corrida: no existe y no deja a nadie bloqueado.
  const username = `sonda-${Date.now()}`;
  const attempt = (i: number) =>
    request.post('/api/v1/auth/login', {
      headers: { 'X-Forwarded-For': `198.51.100.${i}` },
      data: { username, password: 'clave-incorrecta' },
    });
  for (let i = 1; i <= 5; i++) await attempt(i);
  const blocked = await attempt(6);
  expect(blocked.status()).toBe(429);
  expect(Number(blocked.headers()['retry-after'])).toBeGreaterThan(0);
});

test('el panel responde 401 sin sesión a través del proxy', async ({ request }) => {
  const res = await request.get('/api/v1/admin/profile');
  expect(res.status()).toBe(401);
  expect(res.headers()['x-robots-tag']).toBe('noindex');
});
