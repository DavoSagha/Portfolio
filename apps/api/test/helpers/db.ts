import { createDb, type Db } from '../../src/db/client.js';

/** Protección: los tests borran datos, así que solo corren contra una base *_test. */
export function assertTestDatabase(url: string | undefined): asserts url is string {
  if (!url) throw new Error('Falta DATABASE_URL para los tests');
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(`Los tests solo corren contra una base *_test (recibida: "${dbName}")`);
  }
}

export function createTestDb(): Db {
  const url = process.env.DATABASE_URL;
  assertTestDatabase(url);
  return createDb(url);
}

/** Vacía todas las tablas de la aplicación (no la tabla de migraciones). */
export async function resetDb(db: Db) {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
