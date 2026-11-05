import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import type { AuthRepository } from './auth.repository.js';

const COOKIE_NAME = 'sid';
const ABSOLUTE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const INACTIVITY_LIMIT_MS = 2 * 60 * 60 * 1000;
// Actividad con precisión de un minuto: evita una escritura en la base por cada request.
const TOUCH_INTERVAL_MS = 60 * 1000;

const randomToken = () => randomBytes(32).toString('base64url');
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Sesiones en base (D-012): la cookie lleva el token y la base guarda solo su SHA-256. */
export class Sessions {
  constructor(private readonly repo: AuthRepository) {}

  async create(userId: string, userAgent: string | null) {
    const token = randomToken();
    const csrfToken = randomToken();
    await this.repo.createSession({
      tokenHash: hashToken(token),
      userId,
      csrfToken,
      expiresAt: new Date(Date.now() + ABSOLUTE_LIFETIME_MS),
      userAgent: userAgent?.slice(0, 500) ?? null,
    });
    return { token, csrfToken };
  }

  private async findValid(token: string) {
    const session = await this.repo.findSessionByTokenHash(hashToken(token));
    if (!session || session.revokedAt) return null;
    const now = Date.now();
    if (session.expiresAt.getTime() <= now) return null;
    if (now - session.lastSeenAt.getTime() >= INACTIVITY_LIMIT_MS) return null;
    return session;
  }

  /** Devuelve la sesión si sigue vigente. Cualquier motivo de rechazo da el mismo resultado. */
  async authenticate(token: string) {
    const session = await this.findValid(token);
    if (!session) return null;
    if (Date.now() - session.lastSeenAt.getTime() >= TOUCH_INTERVAL_MS) {
      await this.repo.touchSession(session.id);
    }
    return { id: session.id, user: session.user, csrfToken: session.csrfToken };
  }

  /** Solo consulta: no cuenta como actividad, así que no prolonga la sesión. */
  async isValid(token: string) {
    return (await this.findValid(token)) !== null;
  }

  revoke(id: string) {
    return this.repo.revokeSession(id);
  }

  revokeByToken(token: string) {
    return this.repo.revokeSessionByTokenHash(hashToken(token));
  }
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: ABSOLUTE_LIFETIME_MS,
  });
}

/** Con los mismos atributos con que se creó: si no, el navegador no la borra. */
export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: true, sameSite: 'strict', path: '/' });
}

/** Lee el token de la cookie, sin sumar una dependencia para una sola cookie. */
export function readSessionToken(req: Request): string | null {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [name, value] = part.trim().split('=');
    if (name === COOKIE_NAME && value) return value;
  }
  return null;
}
