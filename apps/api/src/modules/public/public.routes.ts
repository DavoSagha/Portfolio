import { Router } from 'express';
import type { PublicController } from './public.controller.js';

export function publicRoutes(controller: PublicController): Router {
  const router = Router();
  router.get('/home', controller.home);
  router.get('/projects', controller.projects);
  router.get('/projects/:slug', controller.project);
  router.get('/timeline', controller.timeline);
  router.get('/skills', controller.skills);
  router.get('/languages', controller.languages);
  return router;
}
