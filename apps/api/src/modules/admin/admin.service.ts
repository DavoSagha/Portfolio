import { AppError, notFound } from '../../http/errors.js';
import type { Locale } from '../../generated/prisma/enums.js';
import type { FileCleanup } from '../files/file-cleanup.js';
import type { ImageService } from '../files/image.service.js';
import type {
  AdminRepository,
  CategoryInput,
  CategoryPatch,
  LanguageInput,
  LanguagePatch,
  ProfileInput,
  ProjectInput,
  ProjectPatch,
  SkillInput,
  SkillPatch,
  TimelineInput,
  TimelinePatch,
} from './admin.repository.js';

/** Ruta privada: sirve también los archivos de contenido que todavía no está publicado. */
const privateFileUrl = (fileId: string | null) => (fileId ? `/api/v1/admin/files/${fileId}` : null);

/** [{ locale: 'es', title }] → { es: { title } }, sin las claves foráneas. */
function translationMap<T extends { locale: Locale }>(rows: T[], foreignKey: keyof T) {
  return Object.fromEntries(
    rows.map((row) => {
      const { locale, [foreignKey]: _omit, ...rest } = row;
      return [locale, rest];
    }),
  );
}

type Found<T> = T | null;
const orNotFound = <T>(value: Found<T>): T => {
  if (value === null) throw notFound();
  return value;
};

/** Reglas del panel. Los formularios de la web no tienen lógica: la verificación vive acá. */
export class AdminService {
  constructor(
    private readonly repo: AdminRepository,
    private readonly images: ImageService,
    private readonly cleanup: FileCleanup,
  ) {}

  // ── Perfil ───────────────────────────────────────────────────

  async getProfile() {
    const profile = orNotFound(await this.repo.findProfile());
    const { translations, photoFileId, ...fields } = profile;
    return {
      ...fields,
      photoUrl: privateFileUrl(photoFileId),
      translations: translationMap(translations, 'profileId'),
    };
  }

  async saveProfile(input: ProfileInput) {
    await this.repo.saveProfile(input);
    return this.getProfile();
  }

  async uploadPhoto(data: Buffer, originalName: string) {
    const file = await this.images.importProfilePhoto({ data, originalName });
    return { photoUrl: privateFileUrl(file.id) };
  }

  removePhoto() {
    return this.images.removeProfilePhoto();
  }

  // ── Categorías de skills ─────────────────────────────────────

  private readonly toCategory = <
    T extends { translations: { locale: Locale; categoryId: string; name: string }[] },
  >({
    translations,
    ...rest
  }: T) => ({ ...rest, translations: translationMap(translations, 'categoryId') });

  categories = {
    list: async () => (await this.repo.listCategories()).map(this.toCategory),
    get: async (id: string) => this.toCategory(orNotFound(await this.repo.findCategory(id))),
    create: async (input: CategoryInput) => this.toCategory(await this.repo.createCategory(input)),
    update: async (id: string, input: CategoryPatch) =>
      this.toCategory(await this.repo.updateCategory(id, input)),
    remove: (id: string) => this.repo.deleteCategory(id),
    reorder: (ids: string[]) => this.repo.reorderCategories(ids),
  };

  // ── Skills ───────────────────────────────────────────────────

  private readonly toSkill = <T extends { projects: { projectId: string }[] }>({
    projects,
    ...rest
  }: T) => ({ ...rest, projectIds: projects.map((p) => p.projectId) });

  private assertPublishable(level: unknown, published: unknown) {
    if (published && !level) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Una skill sin nivel no se puede publicar');
    }
  }

  skills = {
    list: async () => (await this.repo.listSkills()).map(this.toSkill),
    get: async (id: string) => this.toSkill(orNotFound(await this.repo.findSkill(id))),
    create: async (input: SkillInput) => {
      this.assertPublishable(input.level, input.published);
      return this.toSkill(await this.repo.createSkill(input));
    },
    update: async (id: string, input: SkillPatch) => {
      const current = orNotFound(await this.repo.findSkill(id));
      this.assertPublishable(
        input.level === undefined ? current.level : input.level,
        input.published ?? current.published,
      );
      return this.toSkill(await this.repo.updateSkill(id, input));
    },
    remove: (id: string) => this.repo.deleteSkill(id),
    reorder: (ids: string[]) => this.repo.reorderSkills(ids),
  };

  // ── Proyectos ────────────────────────────────────────────────

  private toProject(project: NonNullable<Awaited<ReturnType<AdminRepository['findProject']>>>) {
    const { translations, skills, images, coverFileId, ...rest } = project;
    return {
      ...rest,
      coverUrl: privateFileUrl(coverFileId),
      skillIds: skills.map((s) => s.skillId),
      translations: translationMap(translations, 'projectId'),
      images: images.map((image) => ({
        id: image.id,
        url: privateFileUrl(image.fileId),
        order: image.order,
        translations: translationMap(image.translations, 'imageId'),
      })),
    };
  }

  projects = {
    list: async () => (await this.repo.listProjects()).map((p) => this.toProject(p)),
    get: async (id: string) => this.toProject(orNotFound(await this.repo.findProject(id))),
    create: async (input: ProjectInput) => this.toProject(await this.repo.createProject(input)),
    update: async (id: string, input: ProjectPatch) =>
      this.toProject(await this.repo.updateProject(id, input)),
    remove: async (id: string) => {
      const project = orNotFound(await this.repo.findProject(id));
      await this.repo.deleteProject(id);
      // El borrado en cascada se lleva las imágenes; los archivos se limpian acá.
      await this.cleanup.remove([project.coverFileId, ...project.images.map((i) => i.fileId)]);
    },
    reorder: (ids: string[]) => this.repo.reorderProjects(ids),
  };

  async addProjectImage(
    projectId: string,
    upload: { data: Buffer; originalName: string },
    locale: Locale,
    alt: string,
  ) {
    orNotFound(await this.repo.findProject(projectId));
    const file = await this.images.importImage(upload);
    try {
      const image = await this.repo.addProjectImage(projectId, file.id, locale, alt);
      return { id: image.id, url: privateFileUrl(file.id), order: image.order };
    } catch (err) {
      await this.cleanup.remove([file.id]);
      throw err;
    }
  }

  async removeProjectImage(projectId: string, imageId: string) {
    // Se busca dentro del proyecto: no se puede borrar la imagen de otro por su id.
    const image = orNotFound(await this.repo.findProjectImage(projectId, imageId));
    await this.repo.deleteProjectImage(image.id);
    await this.cleanup.remove([image.fileId]);
  }

  reorderProjectImages(projectId: string, ids: string[]) {
    return this.repo.reorderProjectImages(projectId, ids);
  }

  async setProjectCover(projectId: string, upload: { data: Buffer; originalName: string }) {
    const previous = orNotFound(await this.repo.findProject(projectId)).coverFileId;
    const file = await this.images.importImage(upload);
    await this.repo.setProjectCover(projectId, file.id);
    await this.cleanup.remove([previous]);
    return { coverUrl: privateFileUrl(file.id) };
  }

  async removeProjectCover(projectId: string) {
    const previous = orNotFound(await this.repo.findProject(projectId)).coverFileId;
    await this.repo.setProjectCover(projectId, null);
    await this.cleanup.remove([previous]);
  }

  // ── Trayectoria ──────────────────────────────────────────────

  private readonly toTimeline = <
    T extends {
      translations: {
        locale: Locale;
        entryId: string;
        title: string;
        description: string | null;
      }[];
    },
  >({
    translations,
    ...rest
  }: T) => ({ ...rest, translations: translationMap(translations, 'entryId') });

  timeline = {
    list: async () => (await this.repo.listTimeline()).map(this.toTimeline),
    get: async (id: string) => this.toTimeline(orNotFound(await this.repo.findTimelineEntry(id))),
    create: async (input: TimelineInput) =>
      this.toTimeline(await this.repo.createTimelineEntry(input)),
    update: async (id: string, input: TimelinePatch) => {
      // Las fechas pueden venir de a una: se valida contra la que ya está guardada.
      const current = orNotFound(await this.repo.findTimelineEntry(id));
      const start = input.startDate ?? current.startDate;
      const end = input.endDate === undefined ? current.endDate : input.endDate;
      if (end && end < start) {
        throw new AppError(400, 'VALIDATION_ERROR', 'La fecha de fin es anterior a la de inicio');
      }
      return this.toTimeline(await this.repo.updateTimelineEntry(id, input));
    },
    remove: (id: string) => this.repo.deleteTimelineEntry(id),
    reorder: (ids: string[]) => this.repo.reorderTimeline(ids),
  };

  // ── Idiomas ──────────────────────────────────────────────────

  private readonly toLanguage = <
    T extends { translations: { locale: Locale; languageId: string; name: string }[] },
  >({
    translations,
    ...rest
  }: T) => ({ ...rest, translations: translationMap(translations, 'languageId') });

  languages = {
    list: async () => (await this.repo.listLanguages()).map(this.toLanguage),
    get: async (id: string) => this.toLanguage(orNotFound(await this.repo.findLanguage(id))),
    create: async (input: LanguageInput) => this.toLanguage(await this.repo.createLanguage(input)),
    update: async (id: string, input: LanguagePatch) =>
      this.toLanguage(await this.repo.updateLanguage(id, input)),
    remove: (id: string) => this.repo.deleteLanguage(id),
    reorder: (ids: string[]) => this.repo.reorderLanguages(ids),
  };
}
