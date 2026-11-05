import { Router } from 'express';
import type { AuthController } from './auth.controller.js';

export function authRoutes(controller: AuthController): Router {
  const router = Router();
  router.post('/login', controller.login);
  return router;
}
