import { invalidCredentials, tooManyAttempts } from '../../http/errors.js';
import type { AuthRepository } from './auth.repository.js';
import type { LoginThrottle } from './login-throttle.js';
import { passwords } from './passwords.js';
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

  /** El orden de los pasos es parte de la defensa: ver docs/seguridad.md. */
  async login(input: LoginInput): Promise<{ token: string; csrfToken: string }> {
    // Antes de Argon2: un atacante bloqueado no gasta CPU y la clave correcta tampoco entra.
    const key = this.throttle.keyFor(input.username, input.ip);
    const retryAfter = await this.throttle.retryAfterSeconds(key);
    if (retryAfter > 0) throw tooManyAttempts(retryAfter);

    // Argon2 corre siempre: si el usuario no existe, contra un hash ficticio del mismo costo.
    const admin = await this.repo.findAdminByUsername(input.username);
    const hash = admin?.passwordHash ?? (await passwords.dummyHash());
    const passwordMatches = await passwords.verify(hash, input.password);

    if (!admin || !passwordMatches) {
      await this.throttle.registerFailure(key);
      throw invalidCredentials();
    }

    await this.throttle.clear(key);
    // Fijación de sesión: la cookie anterior no sobrevive al login, y el token siempre es nuevo.
    if (input.previousToken) await this.sessions.revokeByToken(input.previousToken);
    return this.sessions.create(admin.id, input.userAgent);
  }
}
