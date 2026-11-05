import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { CvProfileKey } from '../../generated/prisma/enums.js';
import { notFound } from '../../http/errors.js';
import { normalizeRef, type EventRecorder } from '../metrics/event-recorder.js';
import type { CvService } from './cv.service.js';

const profileParamsSchema = z.object({ profile: z.enum(['backend', 'mainframe', 'soporte']) });

export class CvController {
  constructor(
    private readonly service: CvService,
    private readonly events: EventRecorder,
  ) {}

  primary = async (req: Request, res: Response) => {
    await this.send(req, res);
  };

  byProfile = async (req: Request, res: Response) => {
    const parsed = profileParamsSchema.safeParse(req.params);
    // Es un link público: un perfil desconocido es un 404, no un error de validación.
    if (!parsed.success) throw notFound('Perfil de CV inexistente');
    await this.send(req, res, parsed.data.profile.toUpperCase() as CvProfileKey);
  };

  private async send(req: Request, res: Response, profile?: CvProfileKey) {
    const download = await this.service.getCurrentDownload(profile);
    // HEAD también llega acá, pero no es una descarga.
    if (req.method === 'GET') {
      await this.events.record(req, {
        type: 'CV_DOWNLOAD',
        path: req.path,
        ref: normalizeRef(req.query.ref),
        targetId: download.versionId,
      });
    }
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
