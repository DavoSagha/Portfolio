import { expect, test, type Page } from '@playwright/test';
import { STORAGE_STATE } from './support';

function watchCspViolations(page: Page) {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
  });
  return violations;
}

test.describe('CSP de la web', () => {
  test('el HTML lleva una CSP con nonce distinto en cada respuesta', async ({ request }) => {
    const nonceOf = async () => {
      const res = await request.get('/');
      const csp = res.headers()['content-security-policy'] ?? '';
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).not.toContain('unsafe-eval');
      expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
      return /'nonce-([^']+)'/.exec(csp)?.[1];
    };
    const first = await nonceOf();
    expect(first).toBeTruthy();
    expect(await nonceOf()).not.toBe(first);
  });

  for (const path of ['/', '/proyectos', '/proyectos/appfut', '/admin/login']) {
    test(`${path} funciona sin violaciones de CSP`, async ({ page }) => {
      const violations = watchCspViolations(page);
      await page.goto(path, { waitUntil: 'networkidle' });
      expect(violations).toEqual([]);
    });
  }

  test('los scripts propios corren: el cambio de tema funciona', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const toggle = page.getByRole('button', { name: /modo/i });
    const before = await page.evaluate('document.documentElement.dataset.theme ?? ""');
    await toggle.click();
    await expect
      .poll(() => page.evaluate('document.documentElement.dataset.theme ?? ""'))
      .not.toBe(before);
  });

  test('un script inyectado en el HTML, sin nonce, no se ejecuta', async ({ page }) => {
    // Simula un XSS guardado: el script llega dentro del HTML, con la CSP real de la respuesta.
    await page.route('**/', async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(
        '</head>',
        '<script>window.__inyectado = true</script></head>',
      );
      await route.fulfill({ response, body });
    });
    const violations = watchCspViolations(page);
    await page.goto('/');
    await expect.poll(() => violations.length).toBeGreaterThan(0);
    expect(await page.evaluate('window.__inyectado === true')).toBe(false);
  });

  test.describe('panel', () => {
    test.use({ storageState: STORAGE_STATE });

    for (const path of ['/admin', '/admin/proyectos', '/admin/metricas', '/admin/cv']) {
      test(`${path} funciona sin violaciones de CSP`, async ({ page }) => {
        const violations = watchCspViolations(page);
        await page.goto(path, { waitUntil: 'networkidle' });
        expect(violations).toEqual([]);
      });
    }
  });
});

test.describe('cabeceras', () => {
  test('la web y la API envían las cabeceras de seguridad', async ({ request }) => {
    const web = (await request.get('/')).headers();
    expect(web['x-content-type-options']).toBe('nosniff');
    expect(web['x-frame-options']).toBe('DENY');
    expect(web['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(web['permissions-policy']).toContain('camera=()');
    expect(web['strict-transport-security']).toContain('max-age=31536000');
    expect(web['server']).toBeUndefined();
    expect(web['x-powered-by']).toBeUndefined();

    const api = (await request.get('/api/v1/health')).headers();
    expect(api['content-security-policy']).toContain("default-src 'none'");
    expect(api['x-content-type-options']).toBe('nosniff');
    expect(api['x-powered-by']).toBeUndefined();
  });
});
