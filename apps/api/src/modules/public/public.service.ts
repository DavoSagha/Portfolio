import type { Locale } from '../../generated/prisma/enums.js';
import { notFound } from '../../http/errors.js';
import { DEFAULT_LOCALE, pickTranslation, toDateString } from '../../lib/locale.js';
import type { PublicProject, PublicRepository } from './public.repository.js';

const fileUrl = (fileId: string | null) => (fileId ? `/files/${fileId}` : null);

/** Arma las respuestas públicas (contratos en docs/api.md) a partir de los datos publicados. */
export class PublicService {
  constructor(private readonly repo: PublicRepository) {}

  async getHome(locale: Locale) {
    const profile = await this.repo.findProfile();
    if (!profile) throw notFound('El perfil todavía no fue cargado');
    const t = pickTranslation(profile.translations, locale);

    const [cvProfiles, featured, counts, availableLocales] = await Promise.all([
      this.repo.findCvProfilesWithCurrentVersion(),
      this.repo.findPublishedProjects({ featuredOnly: true }),
      this.repo.countPublished(),
      this.repo.findAvailableLocales(),
    ]);
    const cvKeys = cvProfiles.map((p) => p.key);
    const publicEmail = profile.showEmail ? profile.publicEmail : null;

    return {
      locale,
      availableLocales: availableLocales.length > 0 ? availableLocales : [DEFAULT_LOCALE],
      profile: {
        fullName: profile.fullName,
        headline: t?.headline ?? '',
        valueProp: t?.valueProp ?? '',
        summary: t?.summary ?? '',
        location: profile.location,
        availability: t?.availability ?? '',
        photoUrl: fileUrl(profile.photoFileId),
        linkedinUrl: profile.linkedinUrl,
        githubUrl: profile.githubUrl,
        publicEmail,
      },
      cv: {
        primaryUrl: cvKeys.includes(profile.primaryCvProfile) ? '/cv' : null,
        profiles: cvKeys.map((k) => k.toLowerCase()),
      },
      featuredProjects: featured.map((p) => this.toCard(p, locale)),
      sections: {
        projects: counts.projects > 0,
        timeline: counts.timeline > 0,
        skills: counts.skills > 0,
        languages: counts.languages > 0,
        contact: Boolean(publicEmail || profile.linkedinUrl || profile.githubUrl),
      },
    };
  }

  async listProjects(locale: Locale) {
    const projects = await this.repo.findPublishedProjects();
    return projects.map((p) => this.toCard(p, locale));
  }

  async getProject(slug: string, locale: Locale) {
    const project = await this.repo.findPublishedProjectBySlug(slug);
    if (!project) throw notFound('Proyecto no encontrado');
    const t = pickTranslation(project.translations, locale);
    return {
      ...this.toCard(project, locale),
      context: t?.context ?? null,
      problem: t?.problem ?? null,
      solution: t?.solution ?? null,
      architecture: t?.architecture ?? null,
      decisions: t?.decisions ?? null,
      challenges: t?.challenges ?? null,
      learnings: t?.learnings ?? null,
      limitations: t?.limitations ?? null,
      startDate: toDateString(project.startDate),
      endDate: toDateString(project.endDate),
      images: project.images.map((img) => ({
        url: `/files/${img.fileId}`,
        alt: pickTranslation(img.translations, locale)?.alt ?? '',
      })),
    };
  }

  async getTimeline(locale: Locale) {
    const entries = await this.repo.findPublishedTimeline();
    return entries.map((e) => {
      const t = pickTranslation(e.translations, locale);
      return {
        type: e.type,
        title: t?.title ?? '',
        organization: e.organization,
        startDate: toDateString(e.startDate),
        endDate: toDateString(e.endDate),
        datePrecision: e.datePrecision,
        description: t?.description ?? null,
        credentialUrl: e.credentialUrl,
        relatedProjectSlug: e.relatedProject?.status === 'PUBLISHED' ? e.relatedProject.slug : null,
      };
    });
  }

  async getSkills(locale: Locale) {
    const categories = await this.repo.findPublishedSkillCategories();
    return categories
      .filter((c) => c.skills.length > 0)
      .map((c) => ({
        category: pickTranslation(c.translations, locale)?.name ?? '',
        skills: c.skills.map((s) => ({
          name: s.name,
          level: s.level,
          projects: s.projects.map((ps) => ({
            slug: ps.project.slug,
            title: pickTranslation(ps.project.translations, locale)?.title ?? '',
          })),
        })),
      }));
  }

  async getLanguages(locale: Locale) {
    const languages = await this.repo.findPublishedLanguages();
    return languages.map((l) => ({
      code: l.code,
      name: pickTranslation(l.translations, locale)?.name ?? l.code,
      level: l.level,
    }));
  }

  private toCard(project: PublicProject, locale: Locale) {
    const t = pickTranslation(project.translations, locale);
    return {
      slug: project.slug,
      title: t?.title ?? project.slug,
      summary: t?.summary ?? '',
      role: t?.role ?? '',
      team: project.team,
      origin: project.origin,
      featured: project.featured,
      skills: project.skills.map((ps) => ({ name: ps.skill.name })),
      demoUrl: project.demoUrl,
      repoUrl: project.repoUrl,
      coverUrl: fileUrl(project.coverFileId),
      disclaimer: t?.disclaimer ?? null,
    };
  }
}
