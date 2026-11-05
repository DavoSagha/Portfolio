import { expect, test, type Page } from '@playwright/test';
import { ADMIN, NO_SESSION, STORAGE_STATE } from './support';

const HINT_KEY = 'panel-session-hint';
const VIEWPORTS = [
  { name: 'escritorio', viewport: { width: 1280, height: 900 } },
  { name: 'celular', viewport: { width: 390, height: 844 } },
];

const footer = (page: Page) => page.getByRole('contentinfo');
const access = (page: Page) => footer(page).getByRole('link', { name: 'Acceso' });
const panel = (page: Page) => footer(page).getByRole('link', { name: 'Panel' });
const signOut = (page: Page) => footer(page).getByRole('button', { name: 'Cerrar sesión' });
const hint = (page: Page) => page.evaluate(`localStorage.getItem('${HINT_KEY}')`);

/** Cuenta las consultas que hace el navegador: a la sesión y a las páginas del panel. */
function watchRequests(page: Page) {
  const seen = { me: 0, admin: 0 };
  page.on('request', (req) => {
    const { pathname } = new URL(req.url());
    if (pathname === '/api/v1/auth/me') seen.me++;
    if (pathname.startsWith('/admin')) seen.admin++;
  });
  return seen;
}

async function signInWithForm(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Usuario').fill(ADMIN.username);
  await page.getByLabel('Contraseña').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Panel', level: 1 })).toBeVisible();
}

for (const { name, viewport } of VIEWPORTS) {
  test.describe(`footer en ${name}`, () => {
    test.use({ viewport });

    test.describe('sin sesión', () => {
      test('muestra solo "Acceso" y no consulta la sesión ni el panel', async ({ page }) => {
        const seen = watchRequests(page);
        await page.goto('/', { waitUntil: 'networkidle' });
        await expect(access(page)).toBeVisible();
        await expect(access(page)).toHaveAttribute('href', '/admin');
        await expect(panel(page)).toHaveCount(0);
        await expect(signOut(page)).toHaveCount(0);
        await expect(page.getByRole('banner').getByText(/Acceso|Panel|sesión/)).toHaveCount(0);
        expect(seen).toEqual({ me: 0, admin: 0 });
      });

      test('"Acceso" lleva al login', async ({ page }) => {
        await page.goto('/');
        await access(page).click();
        await expect(page).toHaveURL(/\/admin\/login$/);
      });

      test('una marca sin sesión no da acceso: vuelve "Acceso" y se borra', async ({ page }) => {
        const seen = watchRequests(page);
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(`localStorage.setItem('${HINT_KEY}', '1')`);
        await page.goto('/', { waitUntil: 'networkidle' });
        await expect(access(page)).toBeVisible();
        await expect(panel(page)).toHaveCount(0);
        expect(await hint(page)).toBeNull();
        expect(seen.me).toBe(1);

        // Ya sin marca, la visita siguiente no consulta nada.
        await page.goto('/', { waitUntil: 'networkidle' });
        expect(seen.me).toBe(1);
      });

      test('sin JavaScript el footer funciona igual', async ({ browser }) => {
        const context = await browser.newContext({ viewport, javaScriptEnabled: false });
        const page = await context.newPage();
        await page.goto('/');
        await expect(access(page)).toBeVisible();
        await expect(access(page)).toHaveAttribute('href', '/admin');
        await expect(panel(page)).toHaveCount(0);
        await context.close();
      });
    });

    test.describe('con sesión', () => {
      test.use({ storageState: STORAGE_STATE });

      /** Entrar al panel deja la marca, también para una sesión iniciada antes. */
      const withHint = async (page: Page) => {
        await page.goto('/admin');
        await expect.poll(() => hint(page)).toBe('1');
      };

      test('reemplaza "Acceso" por "Panel" y "Cerrar sesión"; el navbar no cambia', async ({
        page,
        browser,
      }) => {
        const anonymous = await browser.newContext({ viewport, storageState: NO_SESSION });
        const anonymousPage = await anonymous.newPage();
        await anonymousPage.goto('/');
        const publicNavbar = await anonymousPage.getByRole('banner').innerText();
        await anonymous.close();

        await withHint(page);
        const seen = watchRequests(page);
        await page.goto('/');
        await expect(panel(page)).toBeVisible();
        await expect(signOut(page)).toBeVisible();
        await expect(access(page)).toHaveCount(0);
        expect(await page.getByRole('banner').innerText()).toBe(publicNavbar);
        expect(seen.me).toBe(1);

        // La cookie de sesión sigue siendo inaccesible para los scripts.
        expect(await page.evaluate('document.cookie')).not.toContain('sid=');

        await panel(page).click();
        await expect(page.getByRole('heading', { name: 'Panel', level: 1 })).toBeVisible();
      });

      test('dentro del panel el footer no muestra accesos: queda la navegación lateral', async ({
        page,
      }) => {
        await withHint(page);
        const seen = watchRequests(page);
        await page.goto('/admin/proyectos', { waitUntil: 'networkidle' });
        await expect(page.getByRole('navigation', { name: 'Panel' })).toBeVisible();
        await expect(
          page.getByRole('navigation', { name: 'Panel' }).getByRole('button', {
            name: 'Cerrar sesión',
          }),
        ).toBeVisible();
        await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toHaveCount(1);
        await expect(panel(page)).toHaveCount(0);
        await expect(signOut(page)).toHaveCount(0);
        await expect(access(page)).toHaveCount(0);
        expect(seen.me).toBe(0);

        // Al volver al sitio público reaparecen.
        await page.goto('/');
        await expect(panel(page)).toBeVisible();
        await expect(signOut(page)).toBeVisible();
      });

      test('no hay saltos: "Acceso" no se ve mientras se verifica y el alto no cambia', async ({
        page,
      }) => {
        await withHint(page);
        let release = () => {};
        const held = new Promise<void>((resolve) => (release = resolve));
        await page.route('**/api/v1/auth/me', async (route) => {
          await held;
          await route.continue();
        });
        await page.goto('/');
        const link = page.locator('.footer-access');
        await expect(link).toBeHidden();
        const before = await footer(page).boundingBox();
        const pageHeight = await page.evaluate('document.documentElement.scrollHeight');
        release();
        await expect(panel(page)).toBeVisible();
        const after = await footer(page).boundingBox();
        expect(after?.height).toBe(before?.height);
        expect(await page.evaluate('document.documentElement.scrollHeight')).toBe(pageHeight);
      });

      test('el HTML público es el mismo con cookie de sesión: nada para cachear', async ({
        page,
      }) => {
        const html = await (await page.request.get('/')).text();
        const footerHtml = /<footer[\s\S]*<\/footer>/.exec(html)?.[0] ?? '';
        expect(footerHtml).toContain('Acceso');
        expect(footerHtml).not.toContain('Cerrar sesión');
      });

      test('si la sesión venció, vuelve "Acceso" y se borra la marca', async ({ page }) => {
        await withHint(page);
        await page.route('**/api/v1/auth/me', (route) =>
          route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: '{"error":{"code":"UNAUTHENTICATED","message":"Sesión no válida"}}',
          }),
        );
        await page.goto('/');
        await expect(access(page)).toBeVisible();
        await expect(panel(page)).toHaveCount(0);
        expect(await hint(page)).toBeNull();
      });

      test('si falla la red, muestra "Acceso" pero conserva la marca', async ({ page }) => {
        await withHint(page);
        await page.route('**/api/v1/auth/me', (route) => route.abort());
        await page.goto('/');
        await expect(access(page)).toBeVisible();
        expect(await hint(page)).toBe('1');
      });
    });

    test('el login deja la marca; cerrar sesión usa CSRF, revoca y la borra', async ({ page }) => {
      await signInWithForm(page);
      expect(await hint(page)).toBe('1');

      await page.goto('/');
      await expect(signOut(page)).toBeVisible();
      const logoutRequest = page.waitForRequest('**/api/v1/auth/logout');
      await signOut(page).click();
      const headers = (await logoutRequest).headers();
      expect(headers['x-csrf-token']).toBeTruthy();

      await expect(access(page)).toBeVisible();
      await expect(signOut(page)).toHaveCount(0);
      await expect(page).toHaveURL(/\/$/);
      expect(await hint(page)).toBeNull();
      expect((await page.request.get('/api/v1/auth/me')).status()).toBe(401);

      const seen = watchRequests(page);
      await page.goto('/', { waitUntil: 'networkidle' });
      await expect(access(page)).toBeVisible();
      expect(seen.me).toBe(0);
    });
  });
}

test.describe('indexación', () => {
  test('el panel no está en el sitemap y mantiene su noindex', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('<urlset');
    expect(sitemap).not.toContain('/admin');
    for (const path of ['/admin', '/admin/login']) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.headers()['x-robots-tag'], path).toContain('noindex');
    }
    const login = await (await request.get('/admin/login')).text();
    expect(login).toMatch(/<meta name="robots" content="noindex/);
  });

  test('robots.txt no bloquea el panel: un buscador tiene que poder leer su noindex', async ({
    request,
  }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).not.toMatch(/Disallow:\s*\/admin/);
    expect(robots).toMatch(/Disallow:\s*\/api\//);
  });

  test('el link del footer tiene nofollow', async ({ page }) => {
    await page.goto('/');
    await expect(access(page)).toHaveAttribute('rel', 'nofollow');
  });
});
