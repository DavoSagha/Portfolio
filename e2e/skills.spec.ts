import { expect, test, type Page } from '@playwright/test';

/* Tarjetas de skills: orden, despliegue, accesibilidad y distribución. Compara contra la API. */

type ApiGroup = {
  category: string;
  skills: { name: string; level: string | null; projects: { slug: string; title: string }[] }[];
};

const SIZES = [
  { name: 'escritorio', viewport: { width: 1280, height: 800 }, maxColumns: 3 },
  { name: 'celular', viewport: { width: 390, height: 844 }, maxColumns: 1 },
];
const RANK: Record<string, number> = { SOLID: 0, INTERMEDIATE: 1, BASIC: 2 };
const LABEL: Record<string, string> = {
  SOLID: 'Sólido',
  INTERMEDIATE: 'Intermedio',
  BASIC: 'Básico',
};

const section = (page: Page) => page.locator('#skills');
const cards = (page: Page) => section(page).locator('div:has(> h3)');
const firstExpandable = (page: Page) => section(page).locator('details').first();

async function openSkills(page: Page) {
  await page.goto('/#skills');
  await expect(cards(page).first()).toBeVisible();
}

async function apiGroups(page: Page): Promise<ApiGroup[]> {
  const res = await page.request.get('/api/v1/public/skills');
  return (await res.json()) as ApiGroup[];
}

for (const { name, viewport, maxColumns } of SIZES) {
  test.describe(`Skills en ${name}`, () => {
    test.use({ viewport });

    test('hay una tarjeta por categoría, en el orden del panel', async ({ page }) => {
      const groups = await apiGroups(page);
      await openSkills(page);

      await expect(cards(page).locator('h3')).toHaveText(groups.map((g) => g.category));
    });

    test('ordena por nivel y, dentro de cada nivel, respeta el orden del panel', async ({
      page,
    }) => {
      const groups = await apiGroups(page);
      await openSkills(page);

      for (const group of groups) {
        const card = cards(page).filter({
          has: page.getByRole('heading', { name: group.category, exact: true }),
        });
        const expected = group.skills
          .map((skill, index) => ({ skill, index }))
          .sort(
            (a, b) =>
              (RANK[a.skill.level ?? ''] ?? 3) - (RANK[b.skill.level ?? ''] ?? 3) ||
              a.index - b.index,
          )
          .map(({ skill }) => skill);

        await expect(card.locator('ul > li')).toHaveCount(expected.length);
        await expect(card.locator('ul > li span.font-medium')).toHaveText(
          expected.map((skill) => skill.name),
        );
        await expect(card.locator('[data-level]')).toHaveText(
          expected.flatMap((skill) => (skill.level ? [LABEL[skill.level] ?? ''] : [])),
        );
      }
    });

    test('las etiquetas de nivel tienen el mismo ancho y quedan alineadas', async ({ page }) => {
      await openSkills(page);
      const tags = await section(page)
        .locator('[data-level]')
        .evaluateAll((els) =>
          els.map((el) => {
            const box = el.getBoundingClientRect();
            return {
              width: box.width,
              right: box.right,
              card: el.closest('ul')!.getBoundingClientRect().right,
            };
          }),
        );

      expect(tags.length).toBeGreaterThan(0);
      expect(new Set(tags.map((t) => t.width)).size).toBe(1);
      expect(new Set(tags.map((t) => Math.round(t.card - t.right))).size).toBe(1);
    });

    test('solo las skills con proyectos se despliegan', async ({ page }) => {
      const groups = await apiGroups(page);
      await openSkills(page);
      const skills = groups.flatMap((g) => g.skills);
      const withProjects = skills.filter((s) => s.projects.length > 0);

      await expect(section(page).locator('summary')).toHaveCount(withProjects.length);
      test.skip(withProjects.length === skills.length, 'Todas las skills tienen proyectos');
      const plain = skills.find((s) => s.projects.length === 0)!;
      const row = section(page)
        .locator('ul > li')
        .filter({ has: page.getByText(plain.name, { exact: true }) });
      await expect(row.locator('summary')).toHaveCount(0);
      await expect(row.getByRole('link')).toHaveCount(0);
    });

    test('los proyectos están ocultos hasta desplegar y se abren con clic', async ({ page }) => {
      const groups = await apiGroups(page);
      await openSkills(page);
      await expect(section(page).getByRole('link').first()).toBeHidden();
      await expect(section(page).getByText('Usada en').first()).toBeHidden();

      const row = firstExpandable(page);
      const skillName = await row.locator('span.font-medium').innerText();
      const skill = groups.flatMap((g) => g.skills).find((s) => s.name === skillName)!;

      await row.locator('summary').click();
      for (const project of skill.projects) {
        const link = row.getByRole('link', { name: project.title });
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute('href', `/proyectos/${project.slug}`);
      }

      await row.locator('summary').click();
      await expect(row.getByRole('link').first()).toBeHidden();
    });

    test('funciona con teclado: Enter y espacio despliegan, y Tab llega al link', async ({
      page,
    }) => {
      await openSkills(page);
      const row = firstExpandable(page);
      const summary = row.locator('summary');
      const link = row.getByRole('link').first();

      await summary.focus();
      await page.keyboard.press('Tab');
      // Cerrado, el link no recibe el foco.
      expect(await row.evaluate((details) => details.contains(document.activeElement))).toBe(false);

      await summary.focus();
      await page.keyboard.press('Enter');
      await expect(row).toHaveAttribute('open', '');
      await page.keyboard.press('Tab');
      await expect(link).toBeFocused();

      await summary.focus();
      await page.keyboard.press('Space');
      await expect(row).not.toHaveAttribute('open', '');
    });

    test('el lector de pantalla recibe el nombre, el nivel y el estado', async ({ page }) => {
      await openSkills(page);
      const row = firstExpandable(page);
      const skillName = await row.locator('span.font-medium').innerText();
      const level = await row.locator('[data-level]').innerText();

      const client = await page.context().newCDPSession(page);
      const stateOf = async () => {
        const { nodes } = await client.send('Accessibility.getFullAXTree');
        const match = nodes.find(
          (n) =>
            n.role?.value === 'DisclosureTriangle' &&
            String(n.name?.value ?? '').startsWith(skillName),
        );
        return {
          accessibleName: String(match?.name?.value ?? ''),
          expanded: match?.properties?.find((p) => p.name === 'expanded')?.value.value,
        };
      };

      const closed = await stateOf();
      expect(closed.accessibleName).toContain(skillName);
      expect(closed.accessibleName).toContain(level);
      expect(closed.accessibleName).toContain('Ver proyectos');
      expect(closed.expanded).toBe(false);

      await row.locator('summary').click();
      await expect.poll(async () => (await stateOf()).expanded).toBe(true);
    });

    test('despliega sin salto: la altura crece por pasos', async ({ page }) => {
      await openSkills(page);
      const row = firstExpandable(page);

      const heights = await row.evaluate(async (details) => {
        const samples: number[] = [];
        const start = performance.now();
        details.setAttribute('open', '');
        while (performance.now() - start < 400) {
          samples.push(details.getBoundingClientRect().height);
          await new Promise(requestAnimationFrame);
        }
        return samples;
      });

      const closedHeight = heights[0] ?? 0;
      const finalHeight = heights.at(-1) ?? 0;
      expect(finalHeight).toBeGreaterThan(closedHeight);
      const steps = new Set(
        heights.filter((h) => h > closedHeight + 0.5 && h < finalHeight - 0.5).map(Math.round),
      );
      expect(steps.size).toBeGreaterThan(2);
    });

    test('con movimiento reducido, despliega sin animación', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openSkills(page);
      const row = firstExpandable(page);

      const duration = await row.evaluate(
        (details) => getComputedStyle(details, '::details-content').transitionDuration,
      );
      expect(duration.split(',').every((d) => parseFloat(d) === 0)).toBe(true);
    });

    test(`usa hasta ${maxColumns} columna(s), sin huecos ni desborde`, async ({ page }) => {
      await openSkills(page);
      const boxes = await cards(page).evaluateAll((els) =>
        els.map((el) => {
          const box = el.getBoundingClientRect();
          return { left: Math.round(box.left), top: box.top, bottom: box.bottom };
        }),
      );

      const columns = new Map<number, typeof boxes>();
      for (const box of boxes) columns.set(box.left, [...(columns.get(box.left) ?? []), box]);
      expect(columns.size).toBe(Math.min(maxColumns, boxes.length));

      for (const column of columns.values()) {
        for (const [i, box] of column.entries()) {
          const previous = column[i - 1];
          if (previous) expect(box.top - previous.bottom).toBeLessThanOrEqual(16.5);
        }
      }
      // Las columnas terminan a la misma altura: la última tarjeta absorbe la diferencia.
      const bottoms = [...columns.values()].map((c) => Math.round(c.at(-1)?.bottom ?? 0));
      expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(1);

      // Ninguna tarjeta queda con un hueco al final: el espacio se reparte entre sus filas.
      const blanks = await cards(page).evaluateAll((els) =>
        els.map((el) => {
          const rows = el.querySelectorAll('ul > li');
          const last = rows[rows.length - 1]!.getBoundingClientRect();
          return el.getBoundingClientRect().bottom - last.bottom;
        }),
      );
      for (const blank of blanks) expect(blank).toBeLessThanOrEqual(24);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('al desplegar, ninguna tarjeta cambia de columna', async ({ page }) => {
      await openSkills(page);
      const positions = () =>
        cards(page).evaluateAll((els) =>
          els.map((el) => Math.round(el.getBoundingClientRect().left)),
        );
      const before = await positions();

      const summaries = section(page).locator('summary');
      for (let i = 0; i < Math.min(await summaries.count(), 6); i++) await summaries.nth(i).click();

      expect(await positions()).toEqual(before);
    });
  });
}

/* Contraste AA calculado sobre los colores reales, en los dos temas. */
function luminance([r, g, b]: [number, number, number]) {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
type Rgb = [number, number, number];
function contrast(a: Rgb, b: Rgb) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const rgb = (css: string): Rgb => {
  const [r = 0, g = 0, b = 0] = (css.match(/[\d.]+/g) ?? []).map(Number);
  return [r, g, b];
};

for (const colorScheme of ['dark', 'light'] as const) {
  test(`etiquetas de nivel con contraste AA en tema ${colorScheme === 'dark' ? 'oscuro' : 'claro'}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await openSkills(page);
    const tags = await section(page)
      .locator('[data-level]')
      .evaluateAll((els) =>
        els.map((el) => {
          const style = getComputedStyle(el);
          const card = getComputedStyle(el.closest('div:has(> h3)')!);
          return {
            level: el.getAttribute('data-level')!,
            color: style.color,
            background: style.backgroundColor,
            border: style.borderTopColor,
            card: card.backgroundColor,
          };
        }),
      );

    expect(new Set(tags.map((t) => t.level)).size).toBe(3);
    for (const tag of tags) {
      const filled = tag.level === 'SOLID';
      const background = filled ? rgb(tag.background) : rgb(tag.card);
      expect(contrast(rgb(tag.color), background), `texto de ${tag.level}`).toBeGreaterThanOrEqual(
        4.5,
      );
      if (!filled) {
        expect(
          contrast(rgb(tag.border), background),
          `borde de ${tag.level}`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });
}
