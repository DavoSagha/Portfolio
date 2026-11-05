import type { Request, Response } from 'express';
import type { AuthService } from './auth.service.js';

export class AuthController {
  constructor(readonly service: AuthService) {}

  /** A escribir por David: valida el body con Zod, llama al servicio y responde. */
  login = async (_req: Request, _res: Response) => {
    throw new Error('AuthController.login sin implementar');
  };
}
