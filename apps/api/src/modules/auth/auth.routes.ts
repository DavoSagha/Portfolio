import { Router, type RequestHandler } from 'express';
import { limitPerIp, type RateLimit } from '../../http/rate-limit.js';
import type { AuthController } from './auth.controller.js';
import { privateResponse, requireCsrf } from './auth.middleware.js';

export function authRoutes(
  controller: AuthController,
  requireSession: RequestHandler,
  loginRateLimit: RateLimit,
): Router {
  const router = Router();
  router.use(privateResponse);
  router.post('/login', limitPerIp(loginRateLimit), controller.login);
  router.get('/me', requireSession, controller.me);
  router.post('/logout', requireSession, requireCsrf, controller.logout);
  return router;
}
