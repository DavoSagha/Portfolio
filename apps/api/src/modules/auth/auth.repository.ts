import type { Db } from '../../db/client.js';

/** Los nombres se comparan sin distinguir mayúsculas: `Admin` y `admin` son el mismo usuario. */
export const normalizeUsername = (username: string) => username.trim().toLowerCase();

export class AuthRepository {
  constructor(private readonly db: Db) {}

  findAdminByUsername(username: string) {
    return this.db.adminUser.findUnique({ where: { username: normalizeUsername(username) } });
  }

  countAdmins() {
    return this.db.adminUser.count();
  }

  createAdmin(username: string, passwordHash: string) {
    return this.db.adminUser.create({
      data: { username: normalizeUsername(username), passwordHash },
    });
  }

  createSession(data: {
    tokenHash: string;
    userId: string;
    csrfToken: string;
    expiresAt: Date;
    userAgent: string | null;
  }) {
    return this.db.session.create({ data });
  }

  revokeSessionByTokenHash(tokenHash: string) {
    return this.db.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  findThrottle(keyHash: string) {
    return this.db.loginThrottle.findUnique({ where: { keyHash } });
  }

  deleteThrottle(keyHash: string) {
    return this.db.loginThrottle.deleteMany({ where: { keyHash } });
  }

  /**
   * Suma un fallo en una sola sentencia, para que dos intentos simultáneos no cuenten como uno.
   * Si pasó la ventana o venció un bloqueo anterior, la cuenta vuelve a empezar.
   */
  registerThrottleFailure(keyHash: string, maxFailures: number, windowMinutes: number) {
    return this.db.$executeRaw`
      INSERT INTO "LoginThrottle" ("keyHash", "failures", "lockedUntil", "updatedAt")
      VALUES (${keyHash}, 1, NULL, now())
      ON CONFLICT ("keyHash") DO UPDATE SET
        "failures" = CASE
          WHEN "LoginThrottle"."updatedAt" < now() - make_interval(mins => ${windowMinutes}::int)
            OR "LoginThrottle"."lockedUntil" <= now()
          THEN 1
          ELSE "LoginThrottle"."failures" + 1
        END,
        "lockedUntil" = CASE
          WHEN "LoginThrottle"."updatedAt" >= now() - make_interval(mins => ${windowMinutes}::int)
            AND ("LoginThrottle"."lockedUntil" IS NULL OR "LoginThrottle"."lockedUntil" > now())
            AND "LoginThrottle"."failures" + 1 >= ${maxFailures}::int
          THEN now() + make_interval(mins => ${windowMinutes}::int)
          ELSE NULL
        END,
        "updatedAt" = now()`;
  }
}
