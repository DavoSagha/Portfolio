import type { AuthRepository } from './auth.repository.js';
import type { LoginThrottle } from './login-throttle.js';
import type { Sessions } from './sessions.js';

export interface LoginInput {
  username: string;
  password: string;
  ip: string;
  userAgent: string | null;
  /** Token de la cookie que ya traía la request, si había una. */
  previousToken: string | null;
}

export class AuthService {
  constructor(
    readonly repo: AuthRepository,
    readonly sessions: Sessions,
    readonly throttle: LoginThrottle,
  ) {}

  /** A escribir por David. Devuelve el token de la cookie y el token CSRF de la sesión nueva. */
  async login(_input: LoginInput): Promise<{ token: string; csrfToken: string }> {
    throw new Error('AuthService.login sin implementar');
  }
}
