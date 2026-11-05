import type { Request, Response } from 'express';
import { z } from 'zod';
import type { AuthService } from './auth.service.js';
import { readSessionToken, setSessionCookie } from './sessions.js';

// Los máximos frenan el abuso de Argon2, que es caro a propósito. La contraseña no lleva el
// mínimo de admin:create: acá solo se compara, y un 400 le contaría la política a un atacante.
const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(1024),
});

export class AuthController {
  constructor(readonly service: AuthService) {}

  login = async (req: Request, res: Response) => {
    const { username, password } = loginSchema.parse(req.body);

    const { token, csrfToken } = await this.service.login({
      username,
      password,
      // req.ip solo falta si el cliente ya cortó la conexión.
      ip: req.ip ?? 'desconocida',
      userAgent: req.get('user-agent') ?? null,
      previousToken: readSessionToken(req),
    });

    setSessionCookie(res, token);
    res.json({ csrfToken });
  };
}
