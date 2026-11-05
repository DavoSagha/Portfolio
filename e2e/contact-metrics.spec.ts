import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import {
  NO_SESSION,
  SITE_REFRESH_TIMEOUT,
  SLOW_TEST_TIMEOUT,
  STORAGE_STATE,
  samplePdf,
  unique,
} from './support';

const contactForm = (page: Page) => page.locator('#formulario-contacto');
const lowerRef = () => unique('e2e').toLowerCase();

async function refRow(request: APIRequestContext, ref: string) {
  const res = await request.get('/api/v1/admin/metrics/summary');
  const summary = (await res.json()) as {
    byRef: { ref: string; pageViews: number; cvDownloads: number }[];
  };
  return summary.byRef.find((row) => row.ref === ref) ?? null;
}

test.describe('formulario de contacto', () => {
  test('muestra los errores junto a cada campo y después envía', async ({ page, browser }) => {
    const name = unique('Persona');
    await page.goto('/#contacto');
    const form = contactForm(page);
    await form.getByLabel('Nombre').fill(name);
    await form.getByLabel('Email').fill('no-es-email');
    await form.getByLabel('Mensaje').fill('corto');
    await form.getByRole('button', { name: 'Enviar mensaje' }).click();

    const email = form.getByLabel('Email');
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await expect(email).toHaveAccessibleDescription('Ingresá un email válido');
    await expect(form.getByLabel('Mensaje')).toHaveAccessibleDescription(
      'Escribí al menos 10 caracteres',
    );
    await expect(email).toBeFocused();

    await email.fill('persona@ejemplo.com');
    await form.getByLabel('Mensaje').fill('Un mensaje de prueba, suficientemente largo.');
    await form.getByRole('button', { name: 'Enviar mensaje' }).click();
    await expect(form.getByRole('status')).toHaveText('Mensaje enviado. Gracias por escribirme.');
    await expect(form.getByLabel('Nombre')).toHaveValue('');

    // Queda guardado y se ve en el panel; este stack no tiene SMTP, y el panel lo informa.
    const adminContext = await browser.newContext({ storageState: STORAGE_STATE });
    const admin = await adminContext.newPage();
    await admin.goto('/admin/mensajes');
    const item = admin.getByRole('listitem').filter({ hasText: name });
    await expect(item).toContainText('Un mensaje de prueba');
    await expect(item).toContainText('Sin leer');
    await expect(item).toContainText('SMTP sin configurar');

    await item.getByRole('button', { name: /Marcar como leído/ }).click();
    await expect(item.getByRole('button', { name: /Marcar como no leído/ })).toBeVisible();
    await expect(item).not.toContainText('Sin leer');

    admin.on('dialog', (dialog) => void dialog.accept());
    await item.getByRole('button', { name: /^Borrar/ }).click();
    await expect(admin.getByRole('listitem').filter({ hasText: name })).toHaveCount(0);
    await adminContext.close();
  });

  test('el honeypot no se ve ni se alcanza con el teclado', async ({ page }) => {
    await page.goto('/#contacto');
    const honeypot = page.locator('input[name="website"]');
    await expect(honeypot).toHaveAttribute('tabindex', '-1');
    const box = await honeypot.boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThan(0);
  });

  test('sin JavaScript se oculta el formulario y quedan los demás medios', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    await expect(contactForm(page)).toBeHidden();
    // Los localizadores de texto de Playwright ignoran <noscript>: se lee el texto visible.
    expect(await page.locator('#contacto').innerText()).toContain(
      'Para usar el formulario hace falta JavaScript',
    );
    await expect(page.locator('#contacto').getByRole('link', { name: /LinkedIn/ })).toBeVisible();
    await context.close();
  });
});

test.describe('métricas', () => {
  test.use({ storageState: STORAGE_STATE });
  // Las pruebas comparten IP y el límite de eventos es por minuto: algunas tienen que reintentar.
  test.setTimeout(SLOW_TEST_TIMEOUT);

  /** Visitante anónimo, en otro contexto: la sesión del admin no lo alcanza. */
  async function anonymousPage(page: Page) {
    const context = await page.context().browser()!.newContext({ storageState: NO_SESSION });
    return { context, visitor: await context.newPage() };
  }

  test('una visita anónima cuenta con su origen, también en las páginas siguientes', async ({
    page,
  }) => {
    const ref = lowerRef();
    const { context, visitor } = await anonymousPage(page);
    // Por el límite de eventos no se exige un número exacto de visitas.
    await expect
      .poll(
        async () => {
          await visitor.goto(`/?ref=${ref}`, { waitUntil: 'networkidle' });
          return (await refRow(page.request, ref))?.pageViews ?? 0;
        },
        { timeout: SITE_REFRESH_TIMEOUT, intervals: [5000] },
      )
      .toBeGreaterThan(0);

    const before = (await refRow(page.request, ref))?.pageViews ?? 0;
    await expect
      .poll(
        async () => {
          await visitor.goto('/proyectos', { waitUntil: 'networkidle' });
          return (await refRow(page.request, ref))?.pageViews ?? 0;
        },
        { timeout: SITE_REFRESH_TIMEOUT, intervals: [5000] },
      )
      .toBeGreaterThan(before);
    await context.close();
  });

  test('con sesión de admin no se registran visitas ni descargas', async ({ page }) => {
    const ref = lowerRef();
    await page.goto(`/?ref=${ref}`, { waitUntil: 'networkidle' });
    const beacon = await page.request.post('/api/v1/public/events', {
      data: { type: 'PAGE_VIEW', path: '/', ref },
    });
    expect(beacon.status()).toBe(204);
    await page.request.get(`/cv/soporte?ref=${ref}`);
    expect(await refRow(page.request, ref)).toBeNull();
  });

  test('el CV descargado desde el sitio lleva el origen de la visita', async ({ page }) => {
    const ref = lowerRef();
    const pdf = samplePdf(ref);
    const upload = await page.request.get('/api/v1/auth/me');
    const { csrfToken } = (await upload.json()) as { csrfToken: string };
    const created = await page.request.post('/api/v1/admin/cv', {
      headers: { 'X-CSRF-Token': csrfToken },
      multipart: {
        profile: 'backend',
        label: `Versión ${ref}`,
        file: { name: 'cv.pdf', mimeType: 'application/pdf', buffer: pdf },
      },
    });
    expect(created.status()).toBe(201);

    const { context, visitor } = await anonymousPage(page);
    await visitor.goto(`/?ref=${ref}`);
    await visitor.waitForFunction(`sessionStorage.getItem('portfolio-ref') === '${ref}'`);
    await expect
      .poll(
        async () => {
          await visitor.reload();
          const link = visitor.getByRole('link', { name: 'Descargar CV' });
          if ((await link.count()) === 0) return false;
          const download = visitor.waitForEvent('download');
          await link.click();
          await download;
          return ((await refRow(page.request, ref))?.cvDownloads ?? 0) > 0;
        },
        { timeout: SITE_REFRESH_TIMEOUT, intervals: [5000] },
      )
      .toBe(true);
    await context.close();
  });

  test('un clic en un proyecto se ve en el panel de métricas', async ({ page }) => {
    const { context, visitor } = await anonymousPage(page);
    const clicks = async () => {
      const res = await page.request.get('/api/v1/admin/metrics/summary');
      const body = (await res.json()) as { topProjects: { slug: string; clicks: number }[] };
      return body.topProjects.find((p) => p.slug === 'simulador-sistema-operativo')?.clicks ?? 0;
    };
    const before = await clicks();
    await expect
      .poll(
        async () => {
          await visitor.goto('/proyectos');
          await visitor
            .getByRole('link', { name: 'Simulador de sistema operativo', exact: true })
            .click();
          await visitor.waitForURL(/simulador-sistema-operativo/);
          return clicks();
        },
        { timeout: SITE_REFRESH_TIMEOUT, intervals: [5000] },
      )
      .toBeGreaterThan(before);
    await context.close();

    await page.goto('/admin/metricas');
    await expect(page.getByRole('heading', { name: 'Métricas', level: 1 })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Simulador de sistema operativo' })).toBeVisible();
    await expect(page.getByRole('img', { name: /visitas entre/ })).toBeVisible();
    await expect(page.getByText('Visitantes únicos', { exact: true })).toBeVisible();
  });

  test('un rango inválido muestra un error', async ({ page }) => {
    await page.goto('/admin/metricas?desde=2026-03-10&hasta=2026-03-01');
    await expect(page.locator('main').getByRole('alert')).toContainText('El rango no es válido');
  });

  test('el panel no registra sus propias páginas', async ({ page }) => {
    let beacons = 0;
    page.on('request', (req) => {
      if (req.url().endsWith('/api/v1/public/events')) beacons++;
    });
    await page.goto('/admin/metricas', { waitUntil: 'networkidle' });
    expect(beacons).toBe(0);
  });
});
