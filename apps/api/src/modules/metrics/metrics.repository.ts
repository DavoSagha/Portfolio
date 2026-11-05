import type { Db } from '../../db/client.js';
import type { EventType } from '../../generated/prisma/enums.js';

export interface DateRange {
  from: Date;
  /** Exclusivo: el día siguiente al último incluido. */
  until: Date;
}

export class MetricsRepository {
  constructor(private readonly db: Db) {}

  createEvent(data: {
    type: EventType;
    path: string;
    ref: string | null;
    targetId: string | null;
    visitorHash: string;
  }) {
    return this.db.event.create({ data });
  }

  countByType({ from, until }: DateRange) {
    return this.db.event.groupBy({
      by: ['type'],
      where: { createdAt: { gte: from, lt: until } },
      _count: { _all: true },
    });
  }

  /** Únicos por día: la sal rota cada día, así que el mismo hash no existe en dos días. */
  async countDailyVisitors({ from, until }: DateRange) {
    const [row] = await this.db.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM (
        SELECT DISTINCT date_trunc('day', "createdAt" AT TIME ZONE 'UTC'), "visitorHash"
        FROM "Event"
        WHERE "type" = 'PAGE_VIEW' AND "createdAt" >= ${from} AND "createdAt" < ${until}
      ) AS visitors`;
    return Number(row?.count ?? 0);
  }

  async countByRef({ from, until }: DateRange) {
    const rows = await this.db.$queryRaw<{ ref: string; pageViews: bigint; cvDownloads: bigint }[]>`
      SELECT "ref",
        count(*) FILTER (WHERE "type" = 'PAGE_VIEW') AS "pageViews",
        count(*) FILTER (WHERE "type" = 'CV_DOWNLOAD') AS "cvDownloads"
      FROM "Event"
      WHERE "ref" IS NOT NULL AND "createdAt" >= ${from} AND "createdAt" < ${until}
      GROUP BY "ref"
      ORDER BY "pageViews" DESC, "cvDownloads" DESC, "ref" ASC
      LIMIT 50`;
    return rows.map((row) => ({
      ref: row.ref,
      pageViews: Number(row.pageViews),
      cvDownloads: Number(row.cvDownloads),
    }));
  }

  topPaths({ from, until }: DateRange, limit: number) {
    return this.db.event.groupBy({
      by: ['path'],
      where: { type: 'PAGE_VIEW', createdAt: { gte: from, lt: until } },
      _count: { _all: true },
      orderBy: [{ _count: { path: 'desc' } }, { path: 'asc' }],
      take: limit,
    });
  }

  countByTarget(type: EventType, { from, until }: DateRange) {
    return this.db.event.groupBy({
      by: ['targetId'],
      where: { type, targetId: { not: null }, createdAt: { gte: from, lt: until } },
      _count: { _all: true },
      orderBy: [{ _count: { targetId: 'desc' } }, { targetId: 'asc' }],
    });
  }

  findCvVersions(ids: string[]) {
    return this.db.cvVersion.findMany({
      where: { id: { in: ids } },
      select: { id: true, label: true, profileKey: true },
    });
  }

  findProjectsBySlug(slugs: string[]) {
    return this.db.project.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true, translations: { where: { locale: 'es' }, select: { title: true } } },
    });
  }

  async countPerDay(type: EventType, { from, until }: DateRange) {
    const rows = await this.db.$queryRaw<{ date: string; count: bigint }[]>`
      SELECT to_char("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date, count(*) AS count
      FROM "Event"
      WHERE "type" = ${type}::"EventType" AND "createdAt" >= ${from} AND "createdAt" < ${until}
      GROUP BY date`;
    return new Map(rows.map((row) => [row.date, Number(row.count)]));
  }
}
