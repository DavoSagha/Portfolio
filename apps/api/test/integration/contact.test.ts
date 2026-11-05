import { createServer, type Server } from 'node:net';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SmtpMailer } from '../../src/modules/contact/mailer.js';
import { runSeed } from '../../src/seed/seed.js';
import { adminClient } from '../helpers/admin.js';
import { createTestApp } from '../helpers/app.js';
import { createTestDb, resetDb } from '../helpers/db.js';

const db = createTestDb();
let ctx: Awaited<ReturnType<typeof createTestApp>>;

const URL = '/api/v1/public/contact';
const valid = {
  name: 'Ana Pérez',
  email: 'ana@ejemplo.com',
  message: 'Hola, quería consultarte por una búsqueda.',
  website: '',
};
const send = (body: object) => request(ctx.app).post(URL).send(body);

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
  ctx.mailer.sent = [];
  ctx.mailer.failWith = null;
});

describe('POST /public/contact', () => {
  it('guarda el mensaje, lo envía por email y lo marca como enviado', async () => {
    const res = await send(valid);
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ status: 'received' });
    await vi.waitFor(async () => {
      const saved = await db.contactMessage.findFirstOrThrow();
      expect(saved.emailSentAt).not.toBeNull();
    });
    const saved = await db.contactMessage.findFirstOrThrow();
    expect(saved).toMatchObject({
      name: valid.name,
      email: valid.email,
      body: valid.message,
      emailError: null,
      readAt: null,
    });
    expect(ctx.mailer.sent).toEqual([
      { name: valid.name, email: valid.email, body: valid.message },
    ]);
  });

  it('un fallo del SMTP no pierde el mensaje ni se le muestra a quien escribe', async () => {
    ctx.mailer.failWith = new Error('conexión rechazada');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await send(valid);
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ status: 'received' });
    await vi.waitFor(async () => {
      expect((await db.contactMessage.findFirstOrThrow()).emailError).toBe('conexión rechazada');
    });
    const saved = await db.contactMessage.findFirstOrThrow();
    expect(saved.body).toBe(valid.message);
    expect(saved.emailSentAt).toBeNull();
    // El log tiene el motivo, pero no los datos de quien escribió.
    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).not.toContain(valid.email);
    expect(logged).not.toContain(valid.message);
    consoleError.mockRestore();
  });

  it('honeypot: responde igual, pero no guarda ni envía ni cuenta', async () => {
    const res = await send({ ...valid, website: 'https://spam.ejemplo.com' });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ status: 'received' });
    expect(await db.contactMessage.count()).toBe(0);
    expect(ctx.mailer.sent).toEqual([]);
    expect(await db.event.count()).toBe(0);
  });

  it.each([
    ['nombre vacío', { name: ' ' }, 'name'],
    ['nombre largo', { name: 'a'.repeat(101) }, 'name'],
    ['nombre con salto de línea', { name: 'Ana\r\nBcc: x@ejemplo.com' }, 'name'],
    ['email inválido', { email: 'no-es-email' }, 'email'],
    ['email con salto de línea', { email: 'a@b.com\nBcc: x@ejemplo.com' }, 'email'],
    ['mensaje corto', { message: 'Hola' }, 'message'],
    ['mensaje largo', { message: 'a'.repeat(5001) }, 'message'],
    ['nombre que no es texto', { name: { $ne: '' } }, 'name'],
  ])('%s: 400 con el campo señalado, sin guardar', async (_label, change, path) => {
    const res = await send({ ...valid, ...change });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe(path);
    expect(await db.contactMessage.count()).toBe(0);
    expect(ctx.mailer.sent).toEqual([]);
  });

  it('limita los envíos por IP, con Retry-After', async () => {
    const limited = await createTestApp(db, {
      rateLimits: { contact: { limit: 2, windowMs: 60_000 } },
    });
    const post = () => request(limited.app).post(URL).send(valid);
    expect((await post()).status).toBe(202);
    expect((await post()).status).toBe(202);
    const blocked = await post();
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(await db.contactMessage.count()).toBe(2);
    // Un X-Forwarded-For inventado no evade el límite: vale el último salto.
    const spoofed = await request(limited.app)
      .post(URL)
      .set('X-Forwarded-For', '198.51.100.1, 203.0.113.5')
      .send(valid);
    expect(spoofed.status).toBe(202);
    const again = await request(limited.app)
      .post(URL)
      .set('X-Forwarded-For', '198.51.100.2, 203.0.113.5')
      .send(valid);
    expect(again.status).toBe(202);
    const third = await request(limited.app)
      .post(URL)
      .set('X-Forwarded-For', '198.51.100.3, 203.0.113.5')
      .send(valid);
    expect(third.status).toBe(429);
    await limited.cleanup();
  });
});

describe('SmtpMailer', () => {
  /** Servidor SMTP mínimo: suficiente para verificar lo que realmente sale por la red. */
  function fakeSmtp() {
    const received: string[] = [];
    const server: Server = createServer((socket) => {
      let inData = false;
      let data = '';
      socket.write('220 prueba ESMTP\r\n');
      socket.on('data', (chunk) => {
        const text = chunk.toString();
        if (inData) {
          data += text;
          if (data.endsWith('\r\n.\r\n')) {
            inData = false;
            received.push(data);
            socket.write('250 OK\r\n');
          }
          return;
        }
        const command = text.slice(0, 4).toUpperCase();
        if (command === 'EHLO') socket.write('250-prueba\r\n250 AUTH PLAIN\r\n');
        else if (command === 'AUTH') socket.write('235 OK\r\n');
        else if (command === 'DATA') {
          inData = true;
          socket.write('354 Enviar\r\n');
        } else if (command === 'QUIT') socket.end('221 Chau\r\n');
        else socket.write('250 OK\r\n');
      });
    });
    return { server, received };
  }

  const config = {
    host: '127.0.0.1',
    user: 'cuenta',
    pass: 'secreta',
    from: 'cuenta@ejemplo.com',
    to: 'yo@ejemplo.com',
    requireTls: false,
  };

  it('envía a la casilla configurada, con Reply-To de quien escribió', async () => {
    const { server, received } = fakeSmtp();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as { port: number };
    await new SmtpMailer({ ...config, port }).sendContactEmail({
      name: 'Ana Pérez',
      email: 'ana@ejemplo.com',
      body: 'Texto del mensaje',
    });
    server.close();
    const raw = received[0] ?? '';
    expect(raw).toMatch(/^From: cuenta@ejemplo\.com/m);
    expect(raw).toMatch(/^To: yo@ejemplo\.com/m);
    expect(raw).toMatch(/^Reply-To: .*ana@ejemplo\.com/m);
    expect(raw).toContain('Texto del mensaje');
    expect(raw).not.toContain('secreta');
  });

  it('sin servidor, el envío falla con un error', async () => {
    const mailer = new SmtpMailer({ ...config, port: 1 });
    await expect(
      mailer.sendContactEmail({ name: 'A', email: 'a@ejemplo.com', body: 'x' }),
    ).rejects.toThrow();
  });
});

describe('mensajes en el panel', () => {
  it('lista, marca como leído y borra', async () => {
    const admin = await adminClient(ctx.app, db);
    await send(valid);
    let list = await admin.get('/messages');
    expect(list.status).toBe(200);
    expect(list.body.unreadCount).toBe(1);
    expect(list.body.items[0]).toMatchObject({ name: valid.name, readAt: null });
    const { id } = list.body.items[0];

    expect((await admin.patch(`/messages/${id}`).send({ read: true })).body.readAt).not.toBeNull();
    list = await admin.get('/messages?unread=true');
    expect(list.body).toMatchObject({ items: [], unreadCount: 0 });

    await admin.patch(`/messages/${id}`).send({ read: false });
    expect((await admin.get('/messages?unread=true')).body.items).toHaveLength(1);

    expect((await admin.delete(`/messages/${id}`)).status).toBe(204);
    expect(await db.contactMessage.count()).toBe(0);
    expect((await admin.delete(`/messages/${id}`)).status).toBe(404);
  });

  it('pagina con cursor, sin repetir ni saltear mensajes', async () => {
    const admin = await adminClient(ctx.app, db);
    for (let i = 0; i < 5; i++) await send({ ...valid, name: `Persona ${i}` });
    const first = await admin.get('/messages?limit=2');
    expect(first.body.items).toHaveLength(2);
    const second = await admin.get(`/messages?limit=2&cursor=${first.body.nextCursor}`);
    const third = await admin.get(`/messages?limit=2&cursor=${second.body.nextCursor}`);
    expect(third.body.nextCursor).toBeNull();
    const names = [...first.body.items, ...second.body.items, ...third.body.items].map(
      (m: { name: string }) => m.name,
    );
    expect(new Set(names).size).toBe(5);
  });

  it('valida el cuerpo y los parámetros', async () => {
    const admin = await adminClient(ctx.app, db);
    await send(valid);
    const { id } = (await admin.get('/messages')).body.items[0];
    expect((await admin.patch(`/messages/${id}`).send({ read: 'sí' })).status).toBe(400);
    expect((await admin.get('/messages?limit=9999')).status).toBe(400);
    expect((await admin.delete('/messages/NO-VALE')).status).toBe(400);
  });
});
