import { AppError } from '../../http/errors.js';
import type { AuthRepository } from './auth.repository.js';
import { MIN_PASSWORD_LENGTH, passwords } from './passwords.js';

/** Alta del único administrador. No hay endpoint de registro: solo se llama desde la consola. */
export class AdminService {
  constructor(private readonly repo: AuthRepository) {}

  async create(username: string, password: string) {
    if (!/^[a-zA-Z0-9._-]{3,64}$/.test(username)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Usuario inválido: de 3 a 64 caracteres simples');
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
      );
    }
    if ((await this.repo.countAdmins()) > 0) {
      throw new AppError(409, 'CONFLICT', 'Ya existe un administrador');
    }
    return this.repo.createAdmin(username, await passwords.hash(password));
  }
}
