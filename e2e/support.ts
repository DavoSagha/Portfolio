import { expect, type Page } from '@playwright/test';

/** Stack aislado de las pruebas: `npm run test:e2e:up`. Datos solo de prueba. */
export const COMPOSE_PROJECT = 'portfolio-e2e';
export const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:8081';
export const ADMIN = { username: 'e2e-admin', password: 'clave-solo-para-e2e-local' };
export const STORAGE_STATE = 'test-results/admin-state.json';

/** La web cachea los datos 60 s (D-005): se recarga hasta ver el cambio, como máximo 75 s. */
export const SITE_REFRESH_TIMEOUT = 75_000;
export const SLOW_TEST_TIMEOUT = 240_000;

/** Playwright aplica el storageState de `test.use` también a browser.newContext(): se anula. */
export const NO_SESSION = { cookies: [], origins: [] };

export const unique = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export async function reloadUntil(page: Page, path: string, check: () => Promise<boolean>) {
  await expect
    .poll(
      async () => {
        await page.goto(path);
        return check();
      },
      { timeout: SITE_REFRESH_TIMEOUT, intervals: [3000] },
    )
    .toBe(true);
}

export const samplePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export const samplePdf = (text: string) =>
  Buffer.from(`%PDF-1.4\n% ${text}\n1 0 obj << /Type /Catalog >> endobj\ntrailer << >>\n%%EOF\n`);
