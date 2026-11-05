import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import type { Db } from './db/client.js';
import { errorHandler, notFoundHandler } from './http/errors.js';
import { AuthController } from './modules/auth/auth.controller.js';
import { AuthRepository } from './modules/auth/auth.repository.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { AuthService } from './modules/auth/auth.service.js';
import { LoginThrottle } from './modules/auth/login-throttle.js';
import { Sessions } from './modules/auth/sessions.js';
import { CvController } from './modules/cv/cv.controller.js';
import { CvRepository } from './modules/cv/cv.repository.js';
import { CvService } from './modules/cv/cv.service.js';
import { FilesController } from './modules/files/files.controller.js';
import { FilesRepository } from './modules/files/files.repository.js';
import { PublicController } from './modules/public/public.controller.js';
import { PublicRepository } from './modules/public/public.repository.js';
import { publicRoutes } from './modules/public/public.routes.js';
import { PublicService } from './modules/public/public.service.js';
import type { StorageService } from './storage/storage.js';

export interface AppDeps {
  db: Db;
  storage: StorageService;
}

/** Arma la app con dependencias inyectadas: los tests usan una base y un storage propios. */
export function createApp({ db, storage }: AppDeps): Express {
  const app = express();

  // Detrás de Caddy hay exactamente un proxy de confianza (D-015).
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Una API JSON no sirve HTML: la CSP más estricta posible.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
    }),
  );
  // Sin middleware de CORS: la web y la API comparten origen detrás de Caddy (D-002),
  // así que el navegador bloquea cualquier lectura desde otro origen.
  app.use(express.json({ limit: '100kb' }));

  const cvService = new CvService(new CvRepository(db), storage);
  const cv = new CvController(cvService);
  const files = new FilesController(new FilesRepository(db), storage);
  const publicController = new PublicController(new PublicService(new PublicRepository(db)));
  const authRepository = new AuthRepository(db);
  const auth = new AuthController(
    new AuthService(
      authRepository,
      new Sessions(authRepository),
      new LoginThrottle(authRepository),
    ),
  );

  const v1 = Router();
  v1.get('/health', async (_req, res) => {
    await db.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  });
  v1.use('/public', publicRoutes(publicController));
  v1.use('/auth', authRoutes(auth));
  app.use('/api/v1', v1);

  app.get('/cv', cv.primary);
  app.get('/cv/:profile', cv.byProfile);
  app.get('/files/:id', files.show);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
