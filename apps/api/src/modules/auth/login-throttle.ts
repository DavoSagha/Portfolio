import { createHash } from 'node:crypto';
import { normalizeUsername, type AuthRepository } from './auth.repository.js';

const MAX_FAILURES = 5;
const WINDOW_MINUTES = 15;

/** Bloqueo temporal por usuario + IP (D-014). Vale igual para usuarios que no existen. */
export class LoginThrottle {
  constructor(private readonly repo: AuthRepository) {}

  /** El separador evita que dos pares distintos de usuario e IP den la misma clave. */
  keyFor(username: string, ip: string) {
    return createHash('sha256')
      .update(`${normalizeUsername(username)}\0${ip}`)
      .digest('hex');
  }

  /** Segundos que faltan para poder reintentar; 0 si la clave no está bloqueada. */
  async retryAfterSeconds(key: string) {
    const row = await this.repo.findThrottle(key);
    if (!row?.lockedUntil) return 0;
    return Math.max(0, Math.ceil((row.lockedUntil.getTime() - Date.now()) / 1000));
  }

  registerFailure(key: string) {
    return this.repo.registerThrottleFailure(key, MAX_FAILURES, WINDOW_MINUTES);
  }

  clear(key: string) {
    return this.repo.deleteThrottle(key);
  }
}
