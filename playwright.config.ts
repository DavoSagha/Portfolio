import { defineConfig, devices } from '@playwright/test';
import { baseURL } from './e2e/support';

/**
 * Pruebas end-to-end contra un stack completo y aislado (Caddy + web + API + base), que no
 * comparte datos con el de desarrollo: estas pruebas editan contenido.
 * Local: `npm run test:e2e:up` y después `npm run test:e2e`.
 */
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
