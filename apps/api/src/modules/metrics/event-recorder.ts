import { createHash, randomBytes } from 'node:crypto';
import type { Request } from 'express';
import type { EventType } from '../../generated/prisma/enums.js';
import { readSessionToken, type Sessions } from '../auth/sessions.js';
import type { MetricsRepository } from './metrics.repository.js';

const REF_PATTERN = /^[a-z0-9_-]{1,50}$/;

/** `?ref=LinkedIn` → "linkedin". Es un link público: un valor raro se ignora, no da error. */
export function normalizeRef(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const ref = raw.trim().toLowerCase();
  return REF_PATTERN.test(ref) ? ref : null;
}

/**
 * Hash diario del visitante (D-016). La sal es aleatoria, vive solo en memoria y cambia cada
 * día: permite contar visitantes únicos por día, pero no seguir a nadie entre días ni
 * recuperar su IP.
 */
export class VisitorHasher {
  private day = '';
  private salt = Buffer.alloc(0);

  hash(ip: string, userAgent: string, now = new Date()) {
    const today = now.toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.salt = randomBytes(32);
    }
    return createHash('sha256').update(this.salt).update(`\0${ip}\0${userAgent}`).digest('hex');
  }
}

/** Registra eventos, salvo los de una sesión de admin válida. Nunca hace fallar la request. */
export class EventRecorder {
  private readonly hasher = new VisitorHasher();

  constructor(
    private readonly repo: MetricsRepository,
    private readonly sessions: Sessions,
  ) {}

  /** Solo cuenta una sesión validada contra la base: la marca del footer no interviene (D-032). */
  private async isAdmin(req: Request) {
    const token = readSessionToken(req);
    return token ? this.sessions.isValid(token) : false;
  }

  async record(
    req: Request,
    event: { type: EventType; path: string; ref: string | null; targetId: string | null },
  ) {
    try {
      if (await this.isAdmin(req)) return;
      await this.repo.createEvent({
        ...event,
        visitorHash: this.hasher.hash(req.ip ?? 'desconocida', req.get('user-agent') ?? ''),
      });
    } catch (err) {
      console.error('No se pudo registrar el evento:', err);
    }
  }
}
