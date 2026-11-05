import { expect, test, type Page } from '@playwright/test';

/*
 * Paginación de la lista de proyectos en celular (D-027).
 * No asume cuántos proyectos hay: lo calcula desde la página, así no depende del contenido.
 */

const MOBILE = { width: 390, height: 844 };
const PAGE_SIZE = 3;

function projectList(page: Page) {
  const list = page.getByRole('list', { name: 'Proyectos', exact: true });
  return {
    list,
    items: list.locator(':scope > li'),
    visible: list.locator(':scope > li:visible'),
    titles: list.locator(':scope > li:visible h2'),
    nav: page.getByRole('navigation', { name: 'Paginación de proyectos' }),
  };
}

async function totalPagesOf(page: Page) {
  const total = await projectList(page).items.count();
  test.skip(total <= PAGE_SIZE, 'Hacen falta más de 3 proyectos publicados para paginar');
  return { total, totalPages: Math.ceil(total / PAGE_SIZE) };
}

test.describe('Proyectos en celular', () => {
  test.use({ viewport: MOBILE, isMobile: true, hasTouch: true });

  test('el HTML del servidor incluye todos los proyectos', async ({ request }) => {
    const html = await (await request.get('/proyectos')).text();
    const slugs = new Set([...html.matchAll(/href="\/proyectos\/([a-z0-9-]+)"/g)].map((m) => m[1]));
    expect(slugs.size).toBeGreaterThan(PAGE_SIZE);
  });

  test('cambia de página, actualiza la URL y respeta Atrás y Adelante', async ({ page }) => {
    await page.goto('/proyectos');
    const { list, visible, titles, nav } = projectList(page);
    const { total, totalPages } = await totalPagesOf(page);

    await expect(nav.getByText(`Página 1 de ${totalPages}`)).toBeVisible();
    await expect(visible).toHaveCount(PAGE_SIZE);
    await expect(nav.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    await expect(nav.getByRole('button', { name: 'Página 1' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const firstPage = await titles.allTextContents();

    await nav.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page).toHaveURL(/\/proyectos\?pagina=2$/);
    await expect(nav.getByText(`Página 2 de ${totalPages}`)).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Página 2' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(nav.getByRole('button', { name: 'Página 1' })).not.toHaveAttribute('aria-current');
    await expect(visible).toHaveCount(Math.min(PAGE_SIZE, total - PAGE_SIZE));
    expect(await titles.allTextContents()).not.toEqual(firstPage);
    // La vista y el foco van al inicio de la lista.
    await expect(list).toBeFocused();
    if (totalPages === 2) {
      await expect(nav.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    }

    await page.goBack();
    await expect(page).toHaveURL(/\/proyectos$/);
    await expect(nav.getByText(`Página 1 de ${totalPages}`)).toBeVisible();
    await expect(titles).toHaveText(firstPage);

    await page.goForward();
    await expect(page).toHaveURL(/\?pagina=2$/);
    await expect(nav.getByText(`Página 2 de ${totalPages}`)).toBeVisible();
  });

  test('un link compartido abre directamente en la página pedida', async ({ page }) => {
    await page.goto('/proyectos?pagina=2');
    const { nav } = projectList(page);
    const { totalPages } = await totalPagesOf(page);
    await expect(nav.getByText(`Página 2 de ${totalPages}`)).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Anterior' })).toBeEnabled();
  });

  for (const invalid of ['99', '0', '-1', '1.5', 'abc', '']) {
    test(`una página inválida (?pagina=${invalid}) muestra la página 1`, async ({ page }) => {
      await page.goto(`/proyectos?pagina=${invalid}`);
      const { visible, nav } = projectList(page);
      const { totalPages } = await totalPagesOf(page);
      await expect(nav.getByText(`Página 1 de ${totalPages}`)).toBeVisible();
      await expect(visible).toHaveCount(PAGE_SIZE);
      await expect(nav.getByRole('button', { name: 'Página 1' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });
  }

  test('se puede usar solo con teclado', async ({ page }) => {
    await page.goto('/proyectos');
    const { list, nav } = projectList(page);
    const { totalPages } = await totalPagesOf(page);
    await nav.getByRole('button', { name: 'Página 2' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\?pagina=2$/);
    await expect(nav.getByText(`Página 2 de ${totalPages}`)).toBeVisible();
    await expect(list).toBeFocused();
  });

  test('al pasar a escritorio se ven todos y al volver se conserva la página', async ({ page }) => {
    await page.goto('/proyectos?pagina=2');
    const { visible, nav } = projectList(page);
    const { total, totalPages } = await totalPagesOf(page);

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(visible).toHaveCount(total);
    await expect(nav).toBeHidden();
    await expect(page).toHaveURL(/\?pagina=2$/);

    await page.setViewportSize(MOBILE);
    await expect(nav.getByText(`Página 2 de ${totalPages}`)).toBeVisible();
  });
});

test.describe('Proyectos sin JavaScript', () => {
  test.use({ viewport: MOBILE, javaScriptEnabled: false });

  test('se ven todos los proyectos y no hay controles de paginación', async ({ page }) => {
    await page.goto('/proyectos?pagina=2');
    const { items, visible, nav } = projectList(page);
    const total = await items.count();
    expect(total).toBeGreaterThan(PAGE_SIZE);
    await expect(visible).toHaveCount(total);
    await expect(nav).toHaveCount(0);
  });
});

test.describe('Inicio', () => {
  test.use({ viewport: MOBILE });

  test('muestra solo los destacados, sin paginación, con link a la lista completa', async ({
    page,
  }) => {
    await page.goto('/');
    const featured = page.locator('#proyectos ul').first().locator(':scope > li');
    await expect(featured).toHaveCount(3);
    await expect(page.getByRole('navigation', { name: 'Paginación de proyectos' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Ver todos los proyectos' })).toHaveAttribute(
      'href',
      '/proyectos',
    );
  });
});
