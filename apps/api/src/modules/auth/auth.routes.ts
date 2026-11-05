import { Router, type RequestHandler } from 'express';
import { rateLimit, type AugmentedRequest } from 'express-rate-limit';
import { tooManyAttempts } from '../../http/errors.js';
import type { AuthController } from './auth.controller.js';
import { privateResponse, requireCsrf } from './auth.middleware.js';

export interface LoginRateLimit {
  limit: number;
  windowMs: number;
}

/** Sobra para una persona y frena a quien prueba muchos usuarios desde una IP (D-014). */
const DEFAULT_LOGIN_RATE_LIMIT: LoginRateLimit = { limit: 20, windowMs: 15 * 60 * 1000 };

export function authRoutes(
  controller: AuthController,
  requireSession: RequestHandler,
  loginRateLimit: LoginRateLimit = DEFAULT_LOGIN_RATE_LIMIT,
): Router {
  const limiter = rateLimit({
    ...loginRateLimit,
    standardHeaders: false,
    legacyHeaders: false,
    handler: (req, _res, next) => {
      const resetTime = (req as AugmentedRequest).rateLimit?.resetTime;
      const resetAt = resetTime?.getTime() ?? Date.now() + loginRateLimit.windowMs;
      next(tooManyAttempts(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))));
    },
  });

  const router = Router();
  router.use(privateResponse);
  router.post('/login', limiter, controller.login);
  router.get('/me', requireSession, controller.me);
  router.post('/logout', requireSession, requireCsrf, controller.logout);
  return router;
}
