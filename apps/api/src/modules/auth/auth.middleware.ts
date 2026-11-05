import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler, Response } from 'express';
import { csrfInvalid, unauthenticated } from '../../http/errors.js';
import { readSessionToken, type Sessions } from './sessions.js';

type CurrentSession = NonNullable<Awaited<ReturnType<Sessions['authenticate']>>>;

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** La sesión que dejó `requireSession`. Falla si la ruta se montó sin ese middleware. */
export function currentSession(res: Response): CurrentSession {
  const session = res.locals.session as CurrentSession | undefined;
  if (!session) throw unauthenticated();
  return session;
}

export const requireSession =
  (sessions: Sessions): RequestHandler =>
  async (req, res, next) => {
    const token = readSessionToken(req);
    const session = token ? await sessions.authenticate(token) : null;
    if (!session) throw unauthenticated();
    res.locals.session = session;
    next();
  };

/** Compara hashes de largo fijo: timingSafeEqual exige el mismo largo y no revela el del token. */
const sameToken = (a: string, b: string) =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

/** Va después de `requireSession`. Las escrituras exigen el token CSRF de la sesión (D-013). */
export const requireCsrf: RequestHandler = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const sent = req.get('x-csrf-token');
  if (!sent || !sameToken(sent, currentSession(res).csrfToken)) throw csrfInvalid();
  next();
};

/** Respuestas con datos privados: ni cachés ni buscadores las guardan. */
export const privateResponse: RequestHandler = (_req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  next();
};
