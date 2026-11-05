import type { Db } from '../../db/client.js';
import type { Locale } from '../../generated/prisma/enums.js';
import type { z } from 'zod';
import type {
  languagePatchSchema,
  languageSchema,
  profileSchema,
  projectPatchSchema,
  projectSchema,
  skillCategoryPatchSchema,
  skillCategorySchema,
  skillPatchSchema,
  skillSchema,
  timelinePatchSchema,
  timelineSchema,
} from './admin.schemas.js';

export type ProfileInput = z.output<typeof profileSchema>;
export type CategoryInput = z.output<typeof skillCategorySchema>;
export type CategoryPatch = z.output<typeof skillCategoryPatchSchema>;
export type SkillInput = z.output<typeof skillSchema>;
export type SkillPatch = z.output<typeof skillPatchSchema>;
export type ProjectInput = z.output<typeof projectSchema>;
export type ProjectPatch = z.output<typeof projectPatchSchema>;
export type TimelineInput = z.output<typeof timelineSchema>;
export type TimelinePatch = z.output<typeof timelinePatchSchema>;
export type LanguageInput = z.output<typeof languageSchema>;
export type LanguagePatch = z.output<typeof languagePatchSchema>;

const nextOrder = (max: number | null) => (max ?? -1) + 1;

/** Pares [idioma, traducción] sin los idiomas que no vinieron. */
function entriesOf<T>(translations: Partial<Record<Locale, T>> | undefined) {
  return Object.entries(translations ?? {}) as [Locale, T][];
}

const projectInclude = {
  translations: true,
  skills: { select: { skillId: true } },
  images: { orderBy: { order: 'asc' as const }, include: { translations: true } },
};

/** Acceso a datos del panel: a diferencia del sitio público, ve también lo no publicado. */
export class AdminRepository {
  constructor(private readonly db: Db) {}

  // ── Perfil ───────────────────────────────────────────────────

  findProfile() {
    return this.db.profile.findUnique({ where: { id: 1 }, include: { translations: true } });
  }

  saveProfile({ translations, ...fields }: ProfileInput) {
    return this.db.$transaction(async (tx) => {
      await tx.profile.upsert({ where: { id: 1 }, create: { id: 1, ...fields }, update: fields });
      for (const [locale, data] of entriesOf(translations)) {
        await tx.profileTranslation.upsert({
          where: { profileId_locale: { profileId: 1, locale } },
          create: { profileId: 1, locale, ...data },
          update: data,
        });
      }
    });
  }

  // ── Categorías de skills ─────────────────────────────────────

  listCategories() {
    return this.db.skillCategory.findMany({
      orderBy: { order: 'asc' },
      include: { translations: true },
    });
  }

  findCategory(id: string) {
    return this.db.skillCategory.findUnique({ where: { id }, include: { translations: true } });
  }

  async createCategory({ translations, ...fields }: CategoryInput) {
    const { _max } = await this.db.skillCategory.aggregate({ _max: { order: true } });
    return this.db.skillCategory.create({
      data: {
        ...fields,
        order: nextOrder(_max.order),
        translations: {
          create: entriesOf(translations).map(([locale, data]) => ({ locale, ...data })),
        },
      },
      include: { translations: true },
    });
  }

  updateCategory(id: string, { translations, ...fields }: CategoryPatch) {
    return this.db.$transaction(async (tx) => {
      await tx.skillCategory.update({ where: { id }, data: fields });
      for (const [locale, data] of entriesOf(translations)) {
        await tx.skillCategoryTranslation.upsert({
          where: { categoryId_locale: { categoryId: id, locale } },
          create: { categoryId: id, locale, ...data },
          update: data,
        });
      }
      return tx.skillCategory.findUniqueOrThrow({
        where: { id },
        include: { translations: true },
      });
    });
  }

  deleteCategory(id: string) {
    return this.db.skillCategory.delete({ where: { id } });
  }

  reorderCategories(ids: string[]) {
    return this.db.$transaction(
      ids.map((id, order) => this.db.skillCategory.update({ where: { id }, data: { order } })),
    );
  }

  // ── Skills ───────────────────────────────────────────────────

  listSkills() {
    return this.db.skill.findMany({
      orderBy: [{ category: { order: 'asc' } }, { order: 'asc' }],
      include: { projects: { select: { projectId: true } } },
    });
  }

  findSkill(id: string) {
    return this.db.skill.findUnique({
      where: { id },
      include: { projects: { select: { projectId: true } } },
    });
  }

  async createSkill({ projectIds, ...fields }: SkillInput) {
    const { _max } = await this.db.skill.aggregate({
      where: { categoryId: fields.categoryId },
      _max: { order: true },
    });
    return this.db.skill.create({
      data: {
        ...fields,
        order: nextOrder(_max.order),
        projects: { create: projectIds.map((projectId) => ({ projectId })) },
      },
      include: { projects: { select: { projectId: true } } },
    });
  }

  updateSkill(id: string, { projectIds, ...fields }: SkillPatch) {
    return this.db.skill.update({
      where: { id },
      data: {
        ...fields,
        ...(projectIds && {
          projects: {
            deleteMany: {},
            create: projectIds.map((projectId) => ({ projectId })),
          },
        }),
      },
      include: { projects: { select: { projectId: true } } },
    });
  }

  deleteSkill(id: string) {
    return this.db.skill.delete({ where: { id } });
  }

  reorderSkills(ids: string[]) {
    return this.db.$transaction(
      ids.map((id, order) => this.db.skill.update({ where: { id }, data: { order } })),
    );
  }

  // ── Proyectos ────────────────────────────────────────────────

  listProjects() {
    return this.db.project.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      include: projectInclude,
    });
  }

  findProject(id: string) {
    return this.db.project.findUnique({ where: { id }, include: projectInclude });
  }

  async createProject({ translations, skillIds, ...fields }: ProjectInput) {
    const { _max } = await this.db.project.aggregate({ _max: { order: true } });
    return this.db.project.create({
      data: {
        ...fields,
        order: nextOrder(_max.order),
        translations: {
          create: entriesOf(translations).map(([locale, data]) => ({ locale, ...data })),
        },
        skills: { create: skillIds.map((skillId) => ({ skillId })) },
      },
      include: projectInclude,
    });
  }

  updateProject(id: string, { translations, skillIds, ...fields }: ProjectPatch) {
    return this.db.$transaction(async (tx) => {
      await tx.project.update({
        where: { id },
        data: {
          ...fields,
          ...(skillIds && {
            skills: { deleteMany: {}, create: skillIds.map((skillId) => ({ skillId })) },
          }),
        },
      });
      for (const [locale, data] of entriesOf(translations)) {
        await tx.projectTranslation.upsert({
          where: { projectId_locale: { projectId: id, locale } },
          create: { projectId: id, locale, ...data },
          update: data,
        });
      }
      return tx.project.findUniqueOrThrow({ where: { id }, include: projectInclude });
    });
  }

  deleteProject(id: string) {
    return this.db.project.delete({ where: { id } });
  }

  reorderProjects(ids: string[]) {
    return this.db.$transaction(
      ids.map((id, order) => this.db.project.update({ where: { id }, data: { order } })),
    );
  }

  async addProjectImage(projectId: string, fileId: string, locale: Locale, alt: string) {
    const { _max } = await this.db.projectImage.aggregate({
      where: { projectId },
      _max: { order: true },
    });
    return this.db.projectImage.create({
      data: {
        projectId,
        fileId,
        order: nextOrder(_max.order),
        translations: { create: { locale, alt } },
      },
      include: { translations: true },
    });
  }

  findProjectImage(projectId: string, imageId: string) {
    return this.db.projectImage.findFirst({ where: { id: imageId, projectId } });
  }

  deleteProjectImage(imageId: string) {
    return this.db.projectImage.delete({ where: { id: imageId } });
  }

  reorderProjectImages(projectId: string, ids: string[]) {
    return this.db.$transaction(
      ids.map((id, order) =>
        // projectId en el where: no se puede reordenar la imagen de otro proyecto.
        this.db.projectImage.update({ where: { id, projectId }, data: { order } }),
      ),
    );
  }

  setProjectCover(projectId: string, coverFileId: string | null) {
    return this.db.project.update({ where: { id: projectId }, data: { coverFileId } });
  }

  // ── Trayectoria ──────────────────────────────────────────────

  listTimeline() {
    return this.db.timelineEntry.findMany({
      orderBy: [{ order: 'asc' }, { startDate: 'desc' }],
      include: { translations: true },
    });
  }

  findTimelineEntry(id: string) {
    return this.db.timelineEntry.findUnique({ where: { id }, include: { translations: true } });
  }

  async createTimelineEntry({ translations, ...fields }: TimelineInput) {
    const { _max } = await this.db.timelineEntry.aggregate({ _max: { order: true } });
    return this.db.timelineEntry.create({
      data: {
        ...fields,
        order: nextOrder(_max.order),
        translations: {
          create: entriesOf(translations).map(([locale, data]) => ({ locale, ...data })),
        },
      },
      include: { translations: true },
    });
  }

  updateTimelineEntry(id: string, { translations, ...fields }: TimelinePatch) {
    return this.db.$transaction(async (tx) => {
      await tx.timelineEntry.update({ where: { id }, data: fields });
      for (const [locale, data] of entriesOf(translations)) {
        await tx.timelineEntryTranslation.upsert({
          where: { entryId_locale: { entryId: id, locale } },
          create: { entryId: id, locale, ...data },
          update: data,
        });
      }
      return tx.timelineEntry.findUniqueOrThrow({
        where: { id },
        include: { translations: true },
      });
    });
  }

  deleteTimelineEntry(id: string) {
    return this.db.timelineEntry.delete({ where: { id } });
  }

  reorderTimeline(ids: string[]) {
    return this.db.$transaction(
      ids.map((id, order) => this.db.timelineEntry.update({ where: { id }, data: { order } })),
    );
  }

  // ── Idiomas ──────────────────────────────────────────────────

  listLanguages() {
    return this.db.language.findMany({
      orderBy: { order: 'asc' },
      include: { translations: true },
    });
  }

  findLanguage(id: string) {
    return this.db.language.findUnique({ where: { id }, include: { translations: true } });
  }

  async createLanguage({ translations, ...fields }: LanguageInput) {
    const { _max } = await this.db.language.aggregate({ _max: { order: true } });
    return this.db.language.create({
      data: {
        ...fields,
        order: nextOrder(_max.order),
        translations: {
          create: entriesOf(translations).map(([locale, data]) => ({ locale, ...data })),
        },
      },
      include: { translations: true },
    });
  }

  updateLanguage(id: string, { translations, ...fields }: LanguagePatch) {
    return this.db.$transaction(async (tx) => {
      await tx.language.update({ where: { id }, data: fields });
      for (const [locale, data] of entriesOf(translations)) {
        await tx.languageTranslation.upsert({
          where: { languageId_locale: { languageId: id, locale } },
          create: { languageId: id, locale, ...data },
          update: data,
        });
      }
      return tx.language.findUniqueOrThrow({ where: { id }, include: { translations: true } });
    });
  }

  deleteLanguage(id: string) {
    return this.db.language.delete({ where: { id } });
  }

  reorderLanguages(ids: string[]) {
    return this.db.$transaction(
      ids.map((id, order) => this.db.language.update({ where: { id }, data: { order } })),
    );
  }
}
