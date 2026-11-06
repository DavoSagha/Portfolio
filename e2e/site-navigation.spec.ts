import { expect, test } from '@playwright/test';

/* Ruta de navegación del detalle de un proyecto y link del nombre, en celular y escritorio. */

const SIZES = [
  { name: 'escritorio', viewport: { width: 1280, height: 800 } },
  { name: 'celular', viewport: { width: 390, height: 844 } },
];
const PROJECT = { slug: 'appfut', title: 'appFut' };

for (const { name, viewport } of SIZES) {
  test.describe(`Navegación en ${name}`, () => {
    test.use({ viewport });

    test('la ruta muestra Inicio / Proyectos / proyecto, con la página actual marcada', async ({
      page,
    }) => {
      await page.goto(`/proyectos/${PROJECT.slug}`);
      const trail = page.getByRole('navigation', { name: 'Ruta de navegación' });

      await expect(trail).toBeVisible();
      await expect(trail).toHaveText(`Inicio/Proyectos/${PROJECT.title}`);
      await expect(trail.getByRole('listitem')).toHaveCount(3);
      await expect(trail.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/');
      await expect(trail.getByRole('link', { name: 'Proyectos' })).toHaveAttribute(
        'href',
        '/proyectos',
      );

      const current = trail.locator('[aria-current="page"]');
      await expect(current).toHaveText(PROJECT.title);
      await expect(trail.getByRole('link', { name: PROJECT.title })).toHaveCount(0);
      await expect(page.getByText('Todos los proyectos')).toHaveCount(0);
    });

    test('sus links llevan a la lista y al inicio', async ({ page }) => {
      await page.goto(`/proyectos/${PROJECT.slug}`);
      const trail = page.getByRole('navigation', { name: 'Ruta de navegación' });

      await trail.getByRole('link', { name: 'Proyectos' }).click();
      await expect(page).toHaveURL('/proyectos');

      await page.goto(`/proyectos/${PROJECT.slug}`);
      await trail.getByRole('link', { name: 'Inicio' }).click();
      await expect(page).toHaveURL('/');
    });

    test('el nombre del navbar lleva al inicio', async ({ page }) => {
      await page.goto(`/proyectos/${PROJECT.slug}`);
      const name = page.getByRole('banner').getByRole('link').first();

      await expect(name).toHaveAttribute('href', '/');
      await name.click();
      await expect(page).toHaveURL('/');
    });
  });
}
