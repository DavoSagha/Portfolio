import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { AdminService } from '../../src/modules/auth/admin.service.js';
import { AuthRepository } from '../../src/modules/auth/auth.repository.js';
import { createTestDb, resetDb } from '../helpers/db.js';

const db = createTestDb();
const service = new AdminService(new AuthRepository(db));

describe('admin:create', () => {
  beforeEach(() => resetDb(db));
  afterAll(() => db.$disconnect());

  it('crea el administrador con Argon2id y sin guardar la contraseña', async () => {
    const admin = await service.create('Admin', 'una-clave-bien-larga');
    expect(admin.username).toBe('admin');
    expect(admin.passwordHash).toMatch(/^\$argon2id\$.*m=19456,t=2,p=1/);
    expect(admin.passwordHash).not.toContain('una-clave-bien-larga');
  });

  it('falla si ya existe un administrador', async () => {
    await service.create('admin', 'una-clave-bien-larga');
    await expect(service.create('otro', 'otra-clave-bien-larga')).rejects.toMatchObject({
      status: 409,
    });
    expect(await db.adminUser.count()).toBe(1);
  });

  it('rechaza una contraseña corta y un usuario inválido', async () => {
    await expect(service.create('admin', 'corta')).rejects.toMatchObject({ status: 400 });
    await expect(service.create('a b', 'una-clave-bien-larga')).rejects.toMatchObject({
      status: 400,
    });
    expect(await db.adminUser.count()).toBe(0);
  });
});
