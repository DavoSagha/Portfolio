import { Router, type Request, type RequestHandler, type Response } from 'express';
import multer from 'multer';
import type { z } from 'zod';
import type { FilesController } from '../files/files.controller.js';
import type { AdminController } from './admin.controller.js';
import {
  idParams,
  languagePatchSchema,
  languageSchema,
  projectPatchSchema,
  projectSchema,
  reorderSchema,
  skillCategoryPatchSchema,
  skillCategorySchema,
  skillPatchSchema,
  skillSchema,
  timelinePatchSchema,
  timelineSchema,
} from './admin.schemas.js';
import type { AdminService } from './admin.service.js';

/** En memoria: el archivo se valida y se reprocesa antes de escribir nada en disco (D-017). */
const upload: RequestHandler = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10, fieldSize: 10 * 1024 },
}).single('file');

interface CrudOperations<C, P> {
  list: () => Promise<unknown>;
  get: (id: string) => Promise<unknown>;
  create: (input: C) => Promise<unknown>;
  update: (id: string, input: P) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  reorder: (ids: string[]) => Promise<unknown>;
}

/** Las mismas seis rutas para cada recurso (docs/api.md). */
function crudRoutes<CS extends z.ZodType, PS extends z.ZodType>(
  router: Router,
  path: string,
  schemas: { create: CS; update: PS },
  ops: CrudOperations<z.output<CS>, z.output<PS>>,
) {
  const id = (req: Request) => idParams.parse(req.params).id;
  router.get(path, async (_req: Request, res: Response) => {
    res.json(await ops.list());
  });
  router.post(path, async (req: Request, res: Response) => {
    res.status(201).json(await ops.create(schemas.create.parse(req.body)));
  });
  // Antes de /:id: si no, "reorder" se leería como un id.
  router.put(`${path}/reorder`, async (req: Request, res: Response) => {
    await ops.reorder(reorderSchema.parse(req.body).ids);
    res.status(204).end();
  });
  router.get(`${path}/:id`, async (req: Request, res: Response) => {
    res.json(await ops.get(id(req)));
  });
  router.patch(`${path}/:id`, async (req: Request, res: Response) => {
    res.json(await ops.update(id(req), schemas.update.parse(req.body)));
  });
  router.delete(`${path}/:id`, async (req: Request, res: Response) => {
    await ops.remove(id(req));
    res.status(204).end();
  });
}

/**
 * Rutas del panel. Se montan detrás de la sesión y del CSRF (app.ts), así que todo lo que
 * se agregue acá nace protegido.
 */
export function adminRoutes(
  controller: AdminController,
  service: AdminService,
  files: FilesController,
): Router {
  const router = Router();

  router.get('/profile', controller.getProfile);
  router.put('/profile', controller.saveProfile);
  router.post('/profile/photo', upload, controller.uploadPhoto);
  router.delete('/profile/photo', controller.removePhoto);

  crudRoutes(
    router,
    '/skill-categories',
    { create: skillCategorySchema, update: skillCategoryPatchSchema },
    service.categories,
  );
  crudRoutes(router, '/skills', { create: skillSchema, update: skillPatchSchema }, service.skills);
  crudRoutes(
    router,
    '/projects',
    { create: projectSchema, update: projectPatchSchema },
    service.projects,
  );
  crudRoutes(
    router,
    '/timeline',
    { create: timelineSchema, update: timelinePatchSchema },
    service.timeline,
  );
  crudRoutes(
    router,
    '/languages',
    { create: languageSchema, update: languagePatchSchema },
    service.languages,
  );

  router.get('/projects/:id/preview', controller.preview);
  router.post('/projects/:id/images', upload, controller.addImage);
  router.put('/projects/:id/images/reorder', controller.reorderImages);
  router.delete('/projects/:id/images/:imageId', controller.removeImage);
  router.post('/projects/:id/cover', upload, controller.setCover);
  router.delete('/projects/:id/cover', controller.removeCover);

  router.get('/files/:id', files.showPrivate);

  router.get('/cv', controller.listCv);
  router.post('/cv', upload, controller.uploadCv);
  router.put('/cv/primary', controller.setPrimaryCv);
  router.put('/cv/profiles/:profile/current', controller.setCurrentCv);
  router.get('/cv/versions/:id/file', controller.previewCvVersion);
  router.delete('/cv/versions/:id', controller.deleteCvVersion);

  return router;
}
