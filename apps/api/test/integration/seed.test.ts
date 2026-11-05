import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { findPendingContent } from '../../src/content/pending-content.js';
import { runSeed } from '../../src/seed/seed.js';
import { createTestDb, resetDb } from '../helpers/db.js';

const db = createTestDb();

describe('seed', () => {
  beforeEach(() => resetDb(db));
  afterAll(() => db.$disconnect());

  it('carga el contenido inicial en una base vacía', async () => {
    expect(await runSeed(db)).toEqual({ status: 'seeded' });
    expect(await db.profile.count()).toBe(1);
    expect(await db.project.count()).toBe(5);
    expect(await db.language.count()).toBe(4);
    expect(await db.cvProfile.count()).toBe(3);
  });

  it('es idempotente: la segunda ejecución no cambia nada', async () => {
    await runSeed(db);
    const before = await Promise.all([
      db.project.count(),
      db.skill.count(),
      db.timelineEntry.count(),
    ]);
    expect(await runSeed(db)).toMatchObject({ status: 'skipped' });
    const after = await Promise.all([
      db.project.count(),
      db.skill.count(),
      db.timelineEntry.count(),
    ]);
    expect(after).toEqual(before);
  });

  it('no sobrescribe cambios hechos desde el panel ni resucita lo borrado', async () => {
    await runSeed(db);
    await db.profileTranslation.update({
      where: { profileId_locale: { profileId: 1, locale: 'es' } },
      data: { headline: 'Titular editado' },
    });
    await db.skill.updateMany({ where: { name: 'Go' }, data: { name: 'Go 1.26', level: 'SOLID' } });
    const java = await db.skill.findFirstOrThrow({ where: { name: 'Java' } });
    await db.skill.delete({ where: { id: java.id } });

    await runSeed(db);

    const t = await db.profileTranslation.findFirstOrThrow({ where: { profileId: 1 } });
    expect(t.headline).toBe('Titular editado');
    expect(await db.skill.count({ where: { name: 'Go' } })).toBe(0);
    expect(await db.skill.findFirst({ where: { name: 'Go 1.26' } })).toMatchObject({
      level: 'SOLID',
    });
    expect(await db.skill.count({ where: { name: 'Java' } })).toBe(0);
  });

  it('carga las skills con nivel y no inventa links: ningún proyecto tiene demo', async () => {
    await runSeed(db);
    expect(await db.skill.count({ where: { OR: [{ published: false }, { level: null }] } })).toBe(
      0,
    );
    expect(await db.skill.findFirst({ where: { name: 'TypeScript' } })).toMatchObject({
      level: 'INTERMEDIATE',
    });
    expect(await db.project.count({ where: { demoUrl: { not: null } } })).toBe(0);
  });

  it('el contenido inicial no deja pendientes visibles', async () => {
    await runSeed(db);
    // Solo falta lo que se carga por consola: la foto y los PDF del CV.
    expect(await findPendingContent(db)).toEqual([
      'Perfil · foto: falta',
      'CV backend: sin versión vigente',
      'CV mainframe: sin versión vigente',
      'CV soporte: sin versión vigente',
    ]);
  });
});
