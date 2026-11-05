import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { notFound } from '../../http/errors.js';
import type { StorageService } from '../../storage/storage.js';
import type { FilesRepository } from './files.repository.js';

const paramsSchema = z.object({ id: z.string().regex(/^[a-z0-9]{20,40}$/) });

export class FilesController {
  constructor(
    private readonly repo: FilesRepository,
    private readonly storage: StorageService,
  ) {}

  show = async (req: Request, res: Response) => {
    const parsed = paramsSchema.safeParse(req.params);
    if (!parsed.success) throw notFound('Archivo no encontrado');
    const file = await this.repo.findPublicFile(parsed.data.id);
    if (!file) throw notFound('Archivo no encontrado');

    const stream = await this.storage.getStream(file.storageKey);
    res.status(200).set({
      'Content-Type': file.mimeType,
      'Content-Length': String(file.size),
      // Cada archivo nuevo tiene un id nuevo, así que se puede cachear para siempre.
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    await pipeline(stream, res);
  };

  /** Para el panel: cualquier archivo, también de borradores. Requiere sesión (admin.routes). */
  showPrivate = async (req: Request, res: Response) => {
    const parsed = paramsSchema.safeParse(req.params);
    if (!parsed.success) throw notFound('Archivo no encontrado');
    const file = await this.repo.findFile(parsed.data.id);
    if (!file) throw notFound('Archivo no encontrado');
    const stream = await this.storage.getStream(file.storageKey);
    res.status(200).set({ 'Content-Type': file.mimeType, 'Content-Length': String(file.size) });
    await pipeline(stream, res);
  };
}
