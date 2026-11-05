import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import type { Db } from './db/client.js';
import { errorHandler, notFoundHandler } from './http/errors.js';
import { DEFAULT_RATE_LIMITS, type RateLimits } from './http/rate-limit.js';
import { AuthController } from './modules/auth/auth.controller.js';
import { AuthRepository } from './modules/auth/auth.repository.js';
import { AdminController } from './modules/admin/admin.controller.js';
import { AdminRepository } from './modules/admin/admin.repository.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { AdminService } from './modules/admin/admin.service.js';
import { privateResponse, requireCsrf, requireSession } from './modules/auth/auth.middleware.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { AuthService } from './modules/auth/auth.service.js';
import { LoginThrottle } from './modules/auth/login-throttle.js';
import { Sessions } from './modules/auth/sessions.js';
import { ContactRepository } from './modules/contact/contact.repository.js';
import { ContactService } from './modules/contact/contact.service.js';
import type { Mailer } from './modules/contact/mailer.js';
import { CvController } from './modules/cv/cv.controller.js';
import { CvRepository } from './modules/cv/cv.repository.js';
import { CvService } from './modules/cv/cv.service.js';
import { FileCleanup } from './modules/files/file-cleanup.js';
import { FilesController } from './modules/files/files.controller.js';
import { FilesRepository } from './modules/files/files.repository.js';
import { ImageService } from './modules/files/image.service.js';
import { EventRecorder } from './modules/metrics/event-recorder.js';
import { InsightsController } from './modules/metrics/insights.controller.js';
import { MetricsRepository } from './modules/metrics/metrics.repository.js';
import { MetricsService } from './modules/metrics/metrics.service.js';
import { PublicController } from './modules/public/public.controller.js';
import { PublicRepository } from './modules/public/public.repository.js';
import { publicRoutes } from './modules/public/public.routes.js';
import { PublicService } from './modules/public/public.service.js';
import type { StorageService } from './storage/storage.js';

export interface AppDeps {
  db: Db;
  storage: StorageService;
  mailer: Mailer;
  /** Las pruebas los ajustan para no chocar con el límite entre un caso y otro. */
  rateLimits?: RateLimits;
}

/** Arma la app con dependencias inyectadas: los tests usan una base y un storage propios. */
export function createApp({ db, storage, mailer, rateLimits }: AppDeps): Express {
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

  const limits = { ...DEFAULT_RATE_LIMITS, ...rateLimits };

  const authRepository = new AuthRepository(db);
  const sessions = new Sessions(authRepository);
  const auth = new AuthController(
    new AuthService(authRepository, sessions, new LoginThrottle(authRepository)),
  );
  const session = requireSession(sessions);

  const metricsRepository = new MetricsRepository(db);
  const events = new EventRecorder(metricsRepository, sessions);
  const contactRepository = new ContactRepository(db);

  const cvService = new CvService(new CvRepository(db), storage);
  const cv = new CvController(cvService, events);
  const filesRepository = new FilesRepository(db);
  const files = new FilesController(filesRepository, storage);
  const publicService = new PublicService(new PublicRepository(db));
  const publicController = new PublicController(
    publicService,
    new ContactService(contactRepository, mailer),
    events,
  );
  const adminService = new AdminService(
    new AdminRepository(db),
    new ImageService(filesRepository, storage),
    new FileCleanup(filesRepository, storage),
  );
  const admin = new AdminController(adminService, publicService, cvService);
  const insights = new InsightsController(new MetricsService(metricsRepository), contactRepository);

  const v1 = Router();
  v1.get('/health', async (_req, res) => {
    await db.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  });
  v1.use('/public', publicRoutes(publicController, limits));
  v1.use('/auth', authRoutes(auth, session, limits.login));
  // A nivel del router y no por ruta: una ruta nueva nace protegida y no se puede olvidar.
  v1.use(
    '/admin',
    privateResponse,
    session,
    requireCsrf,
    adminRoutes(admin, adminService, files, insights),
  );
  app.use('/api/v1', v1);

  app.get('/cv', cv.primary);
  app.get('/cv/:profile', cv.byProfile);
  app.get('/files/:id', files.show);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
