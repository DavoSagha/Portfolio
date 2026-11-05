import type { Db } from '../db/client.js';
import * as data from './data.js';

export type SeedResult = { status: 'seeded' } | { status: 'skipped'; reason: string };

const date = (value: string | null) => (value ? new Date(`${value}T00:00:00Z`) : null);

/**
 * Carga el contenido inicial solo si la base no tiene contenido (D-011).
 *
 * No busca registro por registro: si alguien renombra o borra un elemento desde el panel,
 * un seed por "clave natural" lo duplicaría o lo resucitaría. Con la regla "todo o nada",
 * el seed es idempotente y nunca pisa cambios hechos desde el panel.
 */
export async function runSeed(db: Db): Promise<SeedResult> {
  return db.$transaction(async (tx) => {
    const existing = await Promise.all([
      tx.profile.count(),
      tx.project.count(),
      tx.skillCategory.count(),
      tx.timelineEntry.count(),
      tx.language.count(),
    ]);
    if (existing.some((n) => n > 0)) {
      return { status: 'skipped', reason: 'la base ya tiene contenido' };
    }

    const { es, ...profileFields } = data.profile;
    await tx.profile.create({
      data: { id: 1, ...profileFields, translations: { create: { locale: 'es', ...es } } },
    });

    await tx.cvProfile.createMany({
      data: [{ key: 'BACKEND' }, { key: 'MAINFRAME' }, { key: 'SOPORTE' }],
      skipDuplicates: true,
    });

    const skillIds = new Map<string, string>();
    for (const [catIndex, category] of data.skillCategories.entries()) {
      const created = await tx.skillCategory.create({
        data: {
          order: catIndex,
          published: true,
          translations: { create: { locale: 'es', name: category.name } },
        },
      });
      for (const [skillIndex, [name, level]] of category.skills.entries()) {
        const skill = await tx.skill.create({
          data: { categoryId: created.id, name, order: skillIndex, level, published: true },
        });
        skillIds.set(name, skill.id);
      }
    }

    const projectIds = new Map<string, string>();
    for (const [index, p] of data.projects.entries()) {
      const project = await tx.project.create({
        data: {
          slug: p.slug,
          status: 'PUBLISHED',
          featured: p.featured,
          inProgress: p.inProgress,
          stack: p.stack,
          repoUrl: p.repoUrl,
          team: p.team,
          origin: p.origin,
          startDate: date(p.startDate),
          endDate: date(p.endDate),
          order: index,
          translations: { create: { locale: 'es', ...p.es } },
          skills: {
            create: p.skills.map((name) => {
              const skillId = skillIds.get(name);
              if (!skillId) throw new Error(`Skill inexistente en el seed: ${name}`);
              return { skillId };
            }),
          },
        },
      });
      projectIds.set(p.slug, project.id);
    }

    // Del más reciente al más antiguo: desde el panel se puede cambiar a mano.
    const timeline = [...data.timeline].sort((a, b) => b.startDate.localeCompare(a.startDate));
    for (const [index, entry] of timeline.entries()) {
      await tx.timelineEntry.create({
        data: {
          type: entry.type,
          organization: entry.organization,
          startDate: date(entry.startDate)!,
          endDate: date(entry.endDate),
          datePrecision: entry.datePrecision,
          credentialUrl: entry.credentialUrl ?? null,
          relatedProjectId: entry.relatedProjectSlug
            ? (projectIds.get(entry.relatedProjectSlug) ?? null)
            : null,
          order: index,
          translations: { create: { locale: 'es', ...entry.es } },
        },
      });
    }

    for (const [index, lang] of data.languages.entries()) {
      await tx.language.create({
        data: {
          code: lang.code,
          level: lang.level,
          order: index,
          translations: { create: { locale: 'es', name: lang.name } },
        },
      });
    }

    return { status: 'seeded' };
  });
}
