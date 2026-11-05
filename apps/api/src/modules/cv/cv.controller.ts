import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { CvProfileKey } from '../../generated/prisma/enums.js';
import { notFound } from '../../http/errors.js';
import type { CvService } from './cv.service.js';

const profileParamsSchema = z.object({ profile: z.enum(['backend', 'mainframe', 'soporte']) });

export class CvController {
  constructor(private readonly service: CvService) {}

  primary = async (_req: Request, res: Response) => {
    await this.send(res);
  };

  byProfile = async (req: Request, res: Response) => {
    const parsed = profileParamsSchema.safeParse(req.params);
    // Es un link público: un perfil desconocido es un 404, no un error de validación.
    if (!parsed.success) throw notFound('Perfil de CV inexistente');
    await this.send(res, parsed.data.profile.toUpperCase() as CvProfileKey);
  };

  private async send(res: Response, profile?: CvProfileKey) {
    const download = await this.service.getCurrentDownload(profile);
    // El registro de la descarga en métricas se agrega en la Fase 4.
    res.status(200).set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(download.size),
      'Content-Disposition': `attachment; filename="${download.fileName}"`,
      // El link es estable pero el contenido cambia al reemplazar la versión vigente.
      'Cache-Control': 'no-cache',
    });
    await pipeline(download.stream, res);
  }
}
