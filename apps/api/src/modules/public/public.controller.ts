import type { Request, Response } from 'express';
import { z } from 'zod';
import { localeQuerySchema } from '../../lib/locale.js';
import type { ContactService } from '../contact/contact.service.js';
import type { EventRecorder } from '../metrics/event-recorder.js';
import type { PublicService } from './public.service.js';

const slugParamsSchema = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,100}$/) });

const contactSchema = z.object({
  // Sin saltos de línea ni caracteres de control: el nombre va en las cabeceras del email.
  name: z
    .string()
    .trim()
    .min(1, 'Ingresá tu nombre')
    .max(100, 'Usá hasta 100 caracteres')
    // eslint-disable-next-line no-control-regex
    .regex(/^[^\x00-\x1f\x7f]+$/, 'El nombre tiene caracteres inválidos'),
  email: z.email('Ingresá un email válido').max(254),
  message: z
    .string()
    .trim()
    .min(10, 'Escribí al menos 10 caracteres')
    .max(5000, 'Usá hasta 5000 caracteres'),
});

/** Solo la ruta: sin query string, que podría traer datos personales. */
const eventSchema = z.object({
  type: z.enum(['PAGE_VIEW', 'PROJECT_CLICK']),
  path: z
    .string()
    .max(200)
    .regex(/^\/[A-Za-z0-9/_-]*$/),
  ref: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{1,50}$/)
    .nullish(),
  targetId: z
    .string()
    .regex(/^[a-z0-9-]{1,100}$/)
    .nullish(),
});

const isPrivatePath = (path: string) => /^\/(admin|api)(\/|$)/.test(path);

/** Traduce HTTP ↔ servicio: valida la entrada con Zod y responde JSON. */
export class PublicController {
  constructor(
    private readonly service: PublicService,
    private readonly contactService: ContactService,
    private readonly events: EventRecorder,
  ) {}

  contact = async (req: Request, res: Response) => {
    const body = req.body as { website?: unknown } | undefined;
    // Honeypot: un bot recibe la misma respuesta que una persona, y no aprende que lo detectaron.
    if (typeof body?.website === 'string' && body.website.length > 0) {
      res.status(202).json({ status: 'received' });
      return;
    }
    const { name, email, message } = contactSchema.parse(req.body);
    await this.contactService.receive({ name, email, body: message });
    await this.events.record(req, {
      type: 'CONTACT_SUBMIT',
      path: '/contacto',
      ref: null,
      targetId: null,
    });
    res.status(202).json({ status: 'received' });
  };

  event = async (req: Request, res: Response) => {
    const { type, path, ref, targetId } = eventSchema.parse(req.body);
    if (!isPrivatePath(path)) {
      await this.events.record(req, { type, path, ref: ref ?? null, targetId: targetId ?? null });
    }
    res.status(204).end();
  };

  home = async (req: Request, res: Response) => {
    const { locale } = localeQuerySchema.parse(req.query);
    res.json(await this.service.getHome(locale));
  };

  projects = async (req: Request, res: Response) => {
    const { locale } = localeQuerySchema.parse(req.query);
    res.json(await this.service.listProjects(locale));
  };

  project = async (req: Request, res: Response) => {
    const { locale } = localeQuerySchema.parse(req.query);
    const { slug } = slugParamsSchema.parse(req.params);
    res.json(await this.service.getProject(slug, locale));
  };

  timeline = async (req: Request, res: Response) => {
    const { locale } = localeQuerySchema.parse(req.query);
    res.json(await this.service.getTimeline(locale));
  };

  skills = async (req: Request, res: Response) => {
    const { locale } = localeQuerySchema.parse(req.query);
    res.json(await this.service.getSkills(locale));
  };

  languages = async (req: Request, res: Response) => {
    const { locale } = localeQuerySchema.parse(req.query);
    res.json(await this.service.getLanguages(locale));
  };
}
