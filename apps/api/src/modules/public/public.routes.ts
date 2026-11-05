import { Router } from 'express';
import { limitPerIp, type RateLimit } from '../../http/rate-limit.js';
import type { PublicController } from './public.controller.js';

export function publicRoutes(
  controller: PublicController,
  limits: { contact: RateLimit; events: RateLimit },
): Router {
  const router = Router();
  router.post('/contact', limitPerIp(limits.contact), controller.contact);
  router.post('/events', limitPerIp(limits.events), controller.event);
  router.get('/home', controller.home);
  router.get('/projects', controller.projects);
  router.get('/projects/:slug', controller.project);
  router.get('/timeline', controller.timeline);
  router.get('/skills', controller.skills);
  router.get('/languages', controller.languages);
  return router;
}
