import { expect, test, type Page } from '@playwright/test';
import {
  ADMIN,
  SLOW_TEST_TIMEOUT,
  STORAGE_STATE,
  reloadUntil,
  samplePdf,
  samplePng,
  unique,
} from './support';

const saved = (page: Page) => page.getByRole('status');

test.describe('acceso al panel', () => {
  test('sin sesión redirige al login, y el panel no se indexa', async ({ page }) => {
    const res = await page.goto('/admin/proyectos');
    await expect(page).toHaveURL(/\/admin\/login$/);
    expect(res?.headers()['x-robots-tag']).toContain('noindex');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('login incorrecto, login correcto y logout', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Usuario').fill(ADMIN.username);
    await page.getByLabel('Contraseña').fill('clave-incorrecta');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('main').getByRole('alert')).toHaveText(
      'Usuario o contraseña incorrectos',
    );

    await page.getByLabel('Contraseña').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { name: 'Panel', level: 1 })).toBeVisible();

    // La sesión no queda al alcance de un script de la página.
    expect(await page.evaluate('document.cookie')).not.toContain('sid=');

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});

test.describe('con sesión', () => {
  test.use({ storageState: STORAGE_STATE });
  test.setTimeout(SLOW_TEST_TIMEOUT);

  test('editar una skill en el panel y verla en el sitio público', async ({ page }) => {
    const name = unique('Skill');
    await page.goto('/admin/skills');
    const category = page.getByRole('region', { name: 'Categoría Backend' });
    await category.getByLabel('Nueva skill').fill(name);
    await category.getByLabel('Nivel').last().selectOption('BASIC');
    await category.getByLabel('Publicada').last().check();
    await category.getByRole('button', { name: 'Agregar' }).click();
    await expect(category.getByText('Skill creada.')).toBeVisible();

    const row = category.getByRole('listitem').filter({ has: page.locator(`[value="${name}"]`) });
    await row.getByLabel('Nivel').selectOption('SOLID');
    await row.getByRole('button', { name: `Guardar ${name}` }).click();
    await expect(row.getByText('Guardada.')).toBeVisible();

    const onSite = page.locator('#skills li').filter({ hasText: name });
    await reloadUntil(page, '/', async () => {
      const text = (await onSite.count()) > 0 ? await onSite.first().innerText() : '';
      return text.includes('Sólido');
    });
  });

  test('crear un borrador, previsualizarlo y publicarlo con todos sus campos', async ({ page }) => {
    const slug = unique('proyecto');
    const title = `Título ${slug}`;
    await page.goto('/admin/proyectos/nuevo');
    await page.getByLabel('Título').fill(title);
    await page.getByLabel('Identificador en la URL').fill(slug);
    await page.getByLabel('Resumen').fill('Resumen de prueba');
    await page.getByLabel('Mi aporte').fill('Aporte de prueba');
    await page.getByLabel('Aviso destacado').fill('Aviso de prueba');
    await page.getByLabel('Equipo').selectOption('INDIVIDUAL');
    await page.getByLabel('Origen').selectOption('PERSONAL');
    await page.getByLabel('Stack').fill('Tecnología uno\nTecnología dos');
    await page.getByLabel('Contexto').fill('Contexto de prueba');
    await page.getByLabel('Mostrar la etiqueta "En desarrollo"').check();
    await page.getByRole('button', { name: 'Crear proyecto' }).click();
    await expect(page).toHaveURL(/\/admin\/proyectos\/(?!nuevo)[a-z0-9]+$/);

    // Borrador: el sitio no lo muestra, y la previsualización sí.
    expect((await page.request.get(`/proyectos/${slug}`)).status()).toBe(404);
    const editUrl = page.url();
    await page.getByRole('link', { name: 'Previsualizar lo guardado' }).click();
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
    await expect(page.getByText('Contexto de prueba')).toBeVisible();

    // Una sección vacía no se muestra.
    await expect(page.getByRole('heading', { name: 'Problema' })).toHaveCount(0);

    await page.goto(editUrl);
    await page.getByLabel('Estado').selectOption('PUBLISHED');
    await page.getByRole('button', { name: 'Guardar proyecto' }).click();
    await expect(saved(page)).toContainText('Proyecto guardado');

    await reloadUntil(page, `/proyectos/${slug}`, () =>
      page.getByRole('heading', { name: title, level: 1 }).isVisible(),
    );
    await expect(page.getByText('En desarrollo')).toBeVisible();
    await expect(page.getByText('Aporte de prueba')).toBeVisible();
    await expect(page.getByRole('note')).toHaveText('Aviso de prueba');
    await expect(page.getByText('Tecnología dos')).toBeVisible();
  });

  test('una demo se carga con su aviso, y al vaciarla desaparecen el link y el aviso', async ({
    page,
  }) => {
    const slug = unique('demo');
    const note = 'Puede tardar en cargar: está en un hosting gratuito.';
    await page.goto('/admin/proyectos/nuevo');
    await page.getByLabel('Título').fill(`Demo ${slug}`);
    await page.getByLabel('Identificador en la URL').fill(slug);
    await page.getByLabel('Resumen').fill('Resumen');
    await page.getByLabel('Estado').selectOption('PUBLISHED');
    await page.getByLabel('Link de la demo').fill('https://demo.ejemplo.com/');
    await page.getByLabel('Aviso de la demo').fill(note);
    await page.getByLabel('Link del repositorio').fill('https://github.com/ejemplo/repo');
    await page.getByRole('button', { name: 'Crear proyecto' }).click();
    await expect(page).toHaveURL(/\/admin\/proyectos\/(?!nuevo)[a-z0-9]+$/);
    const editUrl = page.url();

    await reloadUntil(page, `/proyectos/${slug}`, () =>
      page.getByRole('link', { name: 'Ver demo' }).isVisible(),
    );
    await expect(page.getByRole('link', { name: 'Ver demo' })).toHaveAttribute(
      'href',
      'https://demo.ejemplo.com/',
    );
    await expect(page.getByText(note)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver código' })).toBeVisible();

    await page.goto(editUrl);
    await page.getByLabel('Link de la demo').fill('');
    await page.getByRole('button', { name: 'Guardar proyecto' }).click();
    await expect(saved(page)).toContainText('Proyecto guardado');

    await reloadUntil(
      page,
      `/proyectos/${slug}`,
      async () => (await page.getByRole('link', { name: 'Ver demo' }).count()) === 0,
    );
    await expect(page.getByText(note)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Ver código' })).toBeVisible();
  });

  test('un link peligroso se rechaza y el error se muestra junto al nombre del campo', async ({
    page,
  }) => {
    await page.goto('/admin/proyectos/nuevo');
    await page.getByLabel('Título').fill('X');
    await page.getByLabel('Identificador en la URL').fill(unique('malo'));
    await page.getByLabel('Resumen').fill('Y');
    await page.getByLabel('Link de la demo').fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Crear proyecto' }).click();
    await expect(page.locator('main').getByRole('alert')).toContainText('Link de la demo');
    await expect(page.getByLabel('Link de la demo')).toHaveAttribute('aria-invalid', 'true');
    await expect(page).toHaveURL(/\/nuevo$/);
  });

  test('crear y editar una entrada de la trayectoria; un link vacío no se muestra', async ({
    page,
  }) => {
    const title = unique('Certificado');
    await page.goto('/admin/trayectoria/nuevo');
    await page.getByLabel('Tipo').selectOption('CERTIFICATION');
    await page.getByRole('textbox', { name: /^Título/ }).fill(title);
    await page.getByLabel('Organización').fill('Organización de prueba');
    await page.getByLabel('Descripción').fill('Descripción de prueba');
    await page.getByLabel('Fecha de inicio').fill('2030-01-01');
    await page.getByLabel('Mostrar las fechas como').selectOption('YEAR');
    await page.getByLabel('Link de la credencial').fill('https://ejemplo.com/credencial');
    await page.getByRole('button', { name: 'Crear entrada' }).click();
    await expect(page).toHaveURL(/\/admin\/trayectoria$/);

    const entry = page.locator('#trayectoria li').filter({ hasText: title });
    await reloadUntil(page, '/', async () => (await entry.count()) > 0);
    await expect(entry.getByRole('link', { name: 'Ver credencial' })).toBeVisible();
    await expect(entry).toContainText('2030');

    await page.goto('/admin/trayectoria');
    await page.getByRole('link', { name: title }).click();
    await page.getByLabel('Link de la credencial').fill('');
    await page.getByRole('button', { name: 'Guardar entrada' }).click();
    await expect(saved(page)).toContainText('Entrada guardada');
    await reloadUntil(
      page,
      '/',
      async () => (await entry.getByRole('link', { name: 'Ver credencial' }).count()) === 0,
    );
  });

  test('subir la foto y un CV, y verlos en el sitio', async ({ page }) => {
    await page.goto('/admin/perfil');
    await page.getByLabel(/^Foto/).setInputFiles({
      name: 'foto.png',
      mimeType: 'image/png',
      buffer: samplePng,
    });
    await page.getByRole('button', { name: 'Subir foto' }).click();
    await expect(page.getByRole('status')).toContainText('Foto actualizada');
    await expect(page.getByAltText(/^Foto actual de/)).toBeVisible();
    await reloadUntil(page, '/', async () => (await page.getByAltText(/^Foto de/).count()) > 0);

    const text = unique('cv');
    const label = `Versión ${text}`;
    await page.goto('/admin/cv');
    const card = page.getByRole('region', { name: 'CV Soporte' });
    await card.getByLabel('Archivo PDF').setInputFiles({
      name: 'cv.pdf',
      mimeType: 'application/pdf',
      buffer: samplePdf(text),
    });
    await card.getByLabel('Etiqueta').fill(label);
    await card.getByRole('button', { name: 'Subir CV Soporte' }).click();
    await expect(card.getByText('CV subido.')).toBeVisible();
    await expect(card.getByRole('listitem').filter({ hasText: label })).toContainText('Vigente');

    const download = await page.request.get('/cv/soporte');
    expect(download.status()).toBe(200);
    expect((await download.body()).toString()).toContain(text);
    expect(download.headers()['content-disposition']).toContain('CV-David-Saghatelyan-Soporte.pdf');
  });

  test('una imagen falsa muestra el error de la API', async ({ page }) => {
    await page.goto('/admin/perfil');
    await page.getByLabel(/^Foto/).setInputFiles({
      name: 'foto.png',
      mimeType: 'image/png',
      buffer: samplePdf('no es una imagen'),
    });
    await page.getByRole('button', { name: 'Subir foto' }).click();
    await expect(page.locator('main').getByRole('alert')).toContainText('JPG, PNG o WebP');
  });
});
