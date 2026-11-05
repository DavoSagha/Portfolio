import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import { AppError } from '../../http/errors.js';
import { localeQuerySchema } from '../../lib/locale.js';
import type { CvService } from '../cv/cv.service.js';
import type { PublicService } from '../public/public.service.js';
import type { AdminService } from './admin.service.js';
import {
  cvCurrentSchema,
  cvPrimarySchema,
  cvProfileParams,
  cvUploadSchema,
  idParams,
  imageFieldsSchema,
  profileSchema,
  reorderSchema,
} from './admin.schemas.js';

function uploadedFile(req: Request) {
  if (!req.file) throw new AppError(400, 'VALIDATION_ERROR', 'Falta el archivo');
  return { data: req.file.buffer, originalName: req.file.originalname };
}

/** Los recursos con CRUD estándar no pasan por acá: ver `crudRoutes` en admin.routes.ts. */
export class AdminController {
  constructor(
    private readonly service: AdminService,
    private readonly publicService: PublicService,
    private readonly cv: CvService,
  ) {}

  // ── Perfil ───────────────────────────────────────────────────

  getProfile = async (_req: Request, res: Response) => {
    res.json(await this.service.getProfile());
  };

  saveProfile = async (req: Request, res: Response) => {
    res.json(await this.service.saveProfile(profileSchema.parse(req.body)));
  };

  uploadPhoto = async (req: Request, res: Response) => {
    const { data, originalName } = uploadedFile(req);
    res.json(await this.service.uploadPhoto(data, originalName));
  };

  removePhoto = async (_req: Request, res: Response) => {
    await this.service.removePhoto();
    res.status(204).end();
  };

  // ── Imágenes de proyecto ─────────────────────────────────────

  addImage = async (req: Request, res: Response) => {
    const { id } = idParams.parse(req.params);
    const { alt, locale } = imageFieldsSchema.parse(req.body);
    res.status(201).json(await this.service.addProjectImage(id, uploadedFile(req), locale, alt));
  };

  removeImage = async (req: Request, res: Response) => {
    const { id } = idParams.parse(req.params);
    const { id: imageId } = idParams.parse({ id: req.params.imageId });
    await this.service.removeProjectImage(id, imageId);
    res.status(204).end();
  };

  reorderImages = async (req: Request, res: Response) => {
    const { id } = idParams.parse(req.params);
    await this.service.reorderProjectImages(id, reorderSchema.parse(req.body).ids);
    res.status(204).end();
  };

  setCover = async (req: Request, res: Response) => {
    const { id } = idParams.parse(req.params);
    res.json(await this.service.setProjectCover(id, uploadedFile(req)));
  };

  removeCover = async (req: Request, res: Response) => {
    await this.service.removeProjectCover(idParams.parse(req.params).id);
    res.status(204).end();
  };

  preview = async (req: Request, res: Response) => {
    const { id } = idParams.parse(req.params);
    const { locale } = localeQuerySchema.parse(req.query);
    res.json(await this.publicService.previewProject(id, locale));
  };

  // ── CV ───────────────────────────────────────────────────────

  listCv = async (_req: Request, res: Response) => {
    res.json(await this.cv.listForAdmin());
  };

  uploadCv = async (req: Request, res: Response) => {
    const { profile, label, makeCurrent } = cvUploadSchema.parse(req.body);
    const { data, originalName } = uploadedFile(req);
    const version = await this.cv.importVersion({
      profileKey: profile,
      label,
      data,
      originalName,
      makeCurrent,
    });
    res.status(201).json({ id: version.id, label: version.label });
  };

  setCurrentCv = async (req: Request, res: Response) => {
    const { profile } = cvProfileParams.parse(req.params);
    await this.cv.setCurrent(profile, cvCurrentSchema.parse(req.body).versionId);
    res.status(204).end();
  };

  setPrimaryCv = async (req: Request, res: Response) => {
    await this.cv.setPrimary(cvPrimarySchema.parse(req.body).profile);
    res.status(204).end();
  };

  deleteCvVersion = async (req: Request, res: Response) => {
    await this.cv.deleteVersion(idParams.parse(req.params).id);
    res.status(204).end();
  };

  /** Cualquier versión del historial, para verla en el navegador. No registra métricas. */
  previewCvVersion = async (req: Request, res: Response) => {
    const file = await this.cv.getVersionFile(idParams.parse(req.params).id);
    res.status(200).set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(file.size),
      'Content-Disposition': 'inline',
    });
    await pipeline(file.stream, res);
  };
}
