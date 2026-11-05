import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { request } from '@playwright/test';
import argon2 from 'argon2';
import { ADMIN, COMPOSE_PROJECT, STORAGE_STATE, baseURL } from './support';

const compose = (...args: string[]) =>
  execFileSync('docker', ['compose', '-p', COMPOSE_PROJECT, ...args], { stdio: 'pipe' });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForSite(url: string) {
  const context = await request.newContext({ baseURL: url });
  try {
    for (let attempt = 0; attempt < 60; attempt++) {
      const res = await context.get('/api/v1/health').catch(() => null);
      if (res?.ok()) return;
      await sleep(1000);
    }
    throw new Error(`El stack de pruebas no responde en ${url}. Ejecutá: npm run test:e2e:up`);
  } finally {
    await context.dispose();
  }
}

/**
 * Prepara el stack aislado de pruebas (`portfolio-e2e`, con su propia base y sus archivos):
 * estas pruebas editan contenido, y nunca deben tocar el stack local de desarrollo.
 */
export default async function globalSetup() {
  // El administrador de prueba existe solo en ese stack. El hash no pasa por un shell.
  const hash = await argon2.hash(ADMIN.password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  compose(
    'exec',
    '-T',
    'db',
    'psql',
    '-U',
    'portfolio',
    '-d',
    'portfolio',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    `DELETE FROM "LoginThrottle";
     INSERT INTO "AdminUser" ("id", "username", "passwordHash", "updatedAt")
     VALUES ('e2eadmin0000000000000000', '${ADMIN.username}', '${hash}', now())
     ON CONFLICT ("username") DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash";`,
  );
  // El límite por IP vive en memoria: se reinicia para que las corridas no se acumulen.
  compose('restart', 'api');
  await waitForSite(baseURL);

  const context = await request.newContext({ baseURL });
  const login = await context.post('/api/v1/auth/login', { data: ADMIN });
  if (!login.ok()) throw new Error(`No se pudo iniciar sesión: ${login.status()}`);
  mkdirSync('test-results', { recursive: true });
  await context.storageState({ path: STORAGE_STATE });
  await context.dispose();
}
