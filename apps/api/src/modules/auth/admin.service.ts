import { AppError } from '../../http/errors.js';
import type { AuthRepository } from './auth.repository.js';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, passwords } from './passwords.js';

function assertPasswordPolicy(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `La contraseña debe tener entre ${MIN_PASSWORD_LENGTH} y ${MAX_PASSWORD_LENGTH} caracteres`,
    );
  }
}

/** Alta del único administrador. No hay endpoint de registro: solo se llama desde la consola. */
export class AdminService {
  constructor(private readonly repo: AuthRepository) {}

  async create(username: string, password: string) {
    if (!/^[a-zA-Z0-9._-]{3,64}$/.test(username)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Usuario inválido: de 3 a 64 caracteres simples');
    }
    assertPasswordPolicy(password);
    if ((await this.repo.countAdmins()) > 0) {
      throw new AppError(409, 'CONFLICT', 'Ya existe un administrador');
    }
    return this.repo.createAdmin(username, await passwords.hash(password));
  }

  /** Cambia la contraseña y revoca todas las sesiones: quien la robó queda afuera. */
  async changePassword(password: string) {
    assertPasswordPolicy(password);
    const admin = await this.repo.findOnlyAdmin();
    if (!admin) throw new AppError(404, 'NOT_FOUND', 'Todavía no existe un administrador');
    await this.repo.changePasswordAndRevokeSessions(admin.id, await passwords.hash(password));
    return admin;
  }
}
