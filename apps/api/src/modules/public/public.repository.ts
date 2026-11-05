import type { Db } from '../../db/client.js';

/** Acceso a datos del sitio público: solo devuelve contenido publicado. */
export class PublicRepository {
  constructor(private readonly db: Db) {}

  findProfile() {
    return this.db.profile.findUnique({ where: { id: 1 }, include: { translations: true } });
  }

  findCvProfilesWithCurrentVersion() {
    return this.db.cvProfile.findMany({
      where: { currentVersionId: { not: null } },
      select: { key: true },
    });
  }

  private publishedSkillsOfProject = {
    where: { skill: { published: true, category: { published: true } } },
    include: { skill: true },
    orderBy: { skill: { order: 'asc' as const } },
  };

  findPublishedProjects(options: { featuredOnly?: boolean } = {}) {
    return this.db.project.findMany({
      where: { status: 'PUBLISHED', ...(options.featuredOnly ? { featured: true } : {}) },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      include: { translations: true, skills: this.publishedSkillsOfProject },
    });
  }

  findPublishedProjectBySlug(slug: string) {
    return this.db.project.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: {
        translations: true,
        skills: this.publishedSkillsOfProject,
        images: { orderBy: { order: 'asc' }, include: { translations: true } },
      },
    });
  }

  findPublishedTimeline() {
    return this.db.timelineEntry.findMany({
      where: { published: true },
      orderBy: [{ startDate: 'desc' }, { order: 'asc' }],
      include: {
        translations: true,
        relatedProject: { select: { slug: true, status: true } },
      },
    });
  }

  findPublishedSkillCategories() {
    return this.db.skillCategory.findMany({
      where: { published: true },
      orderBy: { order: 'asc' },
      include: {
        translations: true,
        skills: {
          where: { published: true },
          orderBy: { order: 'asc' },
          include: {
            projects: {
              where: { project: { status: 'PUBLISHED' } },
              include: { project: { include: { translations: true } } },
              orderBy: { project: { order: 'asc' } },
            },
          },
        },
      },
    });
  }

  findPublishedLanguages() {
    return this.db.language.findMany({
      where: { published: true },
      orderBy: { order: 'asc' },
      include: { translations: true },
    });
  }

  async countPublished() {
    const [projects, timeline, skills, languages] = await Promise.all([
      this.db.project.count({ where: { status: 'PUBLISHED' } }),
      this.db.timelineEntry.count({ where: { published: true } }),
      this.db.skill.count({ where: { published: true, category: { published: true } } }),
      this.db.language.count({ where: { published: true } }),
    ]);
    return { projects, timeline, skills, languages };
  }

  /** Locales con traducción del perfil: el selector de idioma se muestra solo si hay más de uno. */
  async findAvailableLocales() {
    const rows = await this.db.profileTranslation.findMany({
      where: { profileId: 1 },
      select: { locale: true },
    });
    return rows.map((r) => r.locale);
  }
}

export type PublicProject = Awaited<ReturnType<PublicRepository['findPublishedProjects']>>[number];
