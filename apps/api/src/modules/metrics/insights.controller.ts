import type { Request, Response } from 'express';
import { z } from 'zod';
import type { ContactRepository } from '../contact/contact.repository.js';
import type { DateRange } from './metrics.repository.js';
import type { MetricsService } from './metrics.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 30;
const MAX_DAYS = 366;

const utcDay = (value: string) => new Date(`${value}T00:00:00Z`);
const today = () => new Date().toISOString().slice(0, 10);

/** Fechas en UTC, ambas incluidas. Por defecto, los últimos 30 días. */
const rangeSchema = z
  .object({ from: z.iso.date().optional(), to: z.iso.date().optional() })
  .transform(({ from, to }): DateRange => {
    const last = utcDay(to ?? today());
    const first = from ? utcDay(from) : new Date(last.getTime() - (DEFAULT_DAYS - 1) * DAY_MS);
    return { from: first, until: new Date(last.getTime() + DAY_MS) };
  })
  .refine(({ from, until }) => from < until, 'La fecha inicial es posterior a la final')
  .refine(
    ({ from, until }) => until.getTime() - from.getTime() <= MAX_DAYS * DAY_MS,
    `El rango no puede superar los ${MAX_DAYS} días`,
  );

const timeseriesSchema = z.object({
  type: z
    .enum(['PAGE_VIEW', 'CV_DOWNLOAD', 'PROJECT_CLICK', 'CONTACT_SUBMIT'])
    .default('PAGE_VIEW'),
});

const idSchema = z.object({ id: z.string().regex(/^[a-z0-9]{20,40}$/) });
const listSchema = z.object({
  unread: z.enum(['true', 'false']).default('false'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z
    .string()
    .regex(/^[a-z0-9]{20,40}$/)
    .optional(),
});
const readSchema = z.object({ read: z.boolean() });

/** Mensajes y métricas del panel. Requieren sesión (admin.routes.ts). */
export class InsightsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly messages: ContactRepository,
  ) {}

  summary = async (req: Request, res: Response) => {
    res.json(await this.metrics.summary(rangeSchema.parse(req.query)));
  };

  timeseries = async (req: Request, res: Response) => {
    const { type } = timeseriesSchema.parse(req.query);
    res.json(await this.metrics.timeseries(type, rangeSchema.parse(req.query)));
  };

  listMessages = async (req: Request, res: Response) => {
    const { unread, limit, cursor } = listSchema.parse(req.query);
    const [rows, unreadCount] = await Promise.all([
      this.messages.list({ unreadOnly: unread === 'true', limit, ...(cursor ? { cursor } : {}) }),
      this.messages.countUnread(),
    ]);
    const items = rows.slice(0, limit);
    res.json({
      items,
      unreadCount,
      nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null,
    });
  };

  updateMessage = async (req: Request, res: Response) => {
    const { id } = idSchema.parse(req.params);
    res.json(await this.messages.setRead(id, readSchema.parse(req.body).read));
  };

  deleteMessage = async (req: Request, res: Response) => {
    await this.messages.delete(idSchema.parse(req.params).id);
    res.status(204).end();
  };
}
