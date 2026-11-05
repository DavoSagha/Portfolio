import type { Request, Response } from 'express';
import { z } from 'zod';
import { localeQuerySchema } from '../../lib/locale.js';
import type { PublicService } from './public.service.js';

const slugParamsSchema = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,100}$/) });

/** Traduce HTTP ↔ servicio: valida la entrada con Zod y responde JSON. */
export class PublicController {
  constructor(private readonly service: PublicService) {}

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
