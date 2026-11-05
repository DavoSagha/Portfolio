import type { EventType } from '../../generated/prisma/enums.js';
import type { DateRange, MetricsRepository } from './metrics.repository.js';

const TOP_LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export class MetricsService {
  constructor(private readonly repo: MetricsRepository) {}

  async summary(range: DateRange) {
    const [totals, uniqueVisitors, byRef, topPaths, cvTargets, projectTargets] = await Promise.all([
      this.repo.countByType(range),
      this.repo.countDailyVisitors(range),
      this.repo.countByRef(range),
      this.repo.topPaths(range, TOP_LIMIT),
      this.repo.countByTarget('CV_DOWNLOAD', range),
      this.repo.countByTarget('PROJECT_CLICK', range),
    ]);
    const total = (type: EventType) => totals.find((t) => t.type === type)?._count._all ?? 0;

    const versions = await this.repo.findCvVersions(cvTargets.map((t) => t.targetId!));
    const projects = await this.repo.findProjectsBySlug(projectTargets.map((t) => t.targetId!));

    return {
      pageViews: total('PAGE_VIEW'),
      uniqueVisitors,
      cvDownloads: total('CV_DOWNLOAD'),
      projectClicks: total('PROJECT_CLICK'),
      contactSubmits: total('CONTACT_SUBMIT'),
      byRef,
      // Una versión borrada conserva sus descargas: el total del período no cambia.
      byCvVersion: cvTargets.map((target) => {
        const version = versions.find((v) => v.id === target.targetId);
        return {
          profile: version?.profileKey.toLowerCase() ?? null,
          versionId: target.targetId,
          label: version?.label ?? null,
          downloads: target._count._all,
        };
      }),
      topPages: topPaths.map((row) => ({ path: row.path, views: row._count._all })),
      // Solo proyectos que existen: un slug inventado en un evento no llega al panel.
      topProjects: projectTargets
        .flatMap((target) => {
          const project = projects.find((p) => p.slug === target.targetId);
          return project
            ? [
                {
                  slug: project.slug,
                  title: project.translations[0]?.title ?? project.slug,
                  clicks: target._count._all,
                },
              ]
            : [];
        })
        .slice(0, TOP_LIMIT),
    };
  }

  /** Un punto por día del rango, también los días sin eventos. */
  async timeseries(type: EventType, range: DateRange) {
    const counts = await this.repo.countPerDay(type, range);
    const days: { date: string; count: number }[] = [];
    for (let t = range.from.getTime(); t < range.until.getTime(); t += DAY_MS) {
      const date = new Date(t).toISOString().slice(0, 10);
      days.push({ date, count: counts.get(date) ?? 0 });
    }
    return days;
  }
}
