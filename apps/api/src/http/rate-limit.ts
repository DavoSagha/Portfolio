import { rateLimit, type AugmentedRequest } from 'express-rate-limit';
import { tooManyAttempts } from './errors.js';

export interface RateLimit {
  limit: number;
  windowMs: number;
}

export type RateLimits = Partial<Record<'login' | 'contact' | 'events', RateLimit>>;

export const DEFAULT_RATE_LIMITS: Required<RateLimits> = {
  /** Sobra para una persona y frena a quien prueba muchos usuarios desde una IP (D-014). */
  login: { limit: 20, windowMs: 15 * 60 * 1000 },
  contact: { limit: 5, windowMs: 60 * 60 * 1000 },
  events: { limit: 60, windowMs: 60 * 1000 },
};

/** Límite por IP, en memoria. Excedido, responde 429 con Retry-After en el formato de la API. */
export function limitPerIp(config: RateLimit) {
  return rateLimit({
    ...config,
    standardHeaders: false,
    legacyHeaders: false,
    handler: (req, _res, next) => {
      const resetTime = (req as AugmentedRequest).rateLimit?.resetTime;
      const resetAt = resetTime?.getTime() ?? Date.now() + config.windowMs;
      next(tooManyAttempts(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))));
    },
  });
}
