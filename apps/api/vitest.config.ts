import { defineConfig } from 'vitest/config';

// Credenciales de desarrollo local (las mismas de .env.example), no son secretos.
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgresql://portfolio:portfolio@localhost:5432/portfolio_test';

// Se fija acá (y no solo en test.env) para que también la vea el globalSetup.
process.env.APP_ENV = 'test';
process.env.DATABASE_URL = testDatabaseUrl;

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    // Los tests de integración comparten una base: se ejecutan de a un archivo.
    fileParallelism: false,
    env: {
      APP_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
    },
  },
});
