import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import type { AuthRepository } from './auth.repository.js';

const COOKIE_NAME = 'sid';
const ABSOLUTE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

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

/** Lee el token de la cookie, sin sumar una dependencia para una sola cookie. */
export function readSessionToken(req: Request): string | null {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [name, value] = part.trim().split('=');
    if (name === COOKIE_NAME && value) return value;
  }
  return null;
}
