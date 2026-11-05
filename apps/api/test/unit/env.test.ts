import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';

const base = { DATABASE_URL: 'postgresql://u:secreta@localhost:5432/app' };

describe('loadEnv', () => {
  it('aplica valores por defecto en desarrollo', () => {
    const env = loadEnv(base);
    expect(env.APP_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
  });

  it('falla al iniciar si falta una variable obligatoria, sin mostrar valores', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it('en producción rechaza la contraseña de ejemplo y SITE_URL sin https', () => {
    const prod = {
      APP_ENV: 'production',
      DATABASE_URL: 'postgresql://portfolio:portfolio@db:5432/portfolio',
      SITE_URL: 'http://ejemplo.com',
    };
    let message = '';
    try {
      loadEnv(prod);
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toMatch(/DATABASE_URL/);
    expect(message).toMatch(/SITE_URL/);
    expect(message).not.toContain('portfolio:portfolio');
  });

  it('acepta una configuración de producción válida', () => {
    const env = loadEnv({
      APP_ENV: 'production',
      DATABASE_URL: 'postgresql://portfolio:Larga-y-Aleatoria@db:5432/portfolio',
      SITE_URL: 'https://ejemplo.com',
    });
    expect(env.APP_ENV).toBe('production');
  });
});
