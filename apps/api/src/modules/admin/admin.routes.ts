import { Router } from 'express';

/**
 * Rutas del panel. Se montan detrás de la sesión y del CSRF (app.ts), así que todo lo que
 * se agregue acá nace protegido. Los recursos llegan en la Fase 3.
 */
export function adminRoutes(): Router {
  return Router();
}
