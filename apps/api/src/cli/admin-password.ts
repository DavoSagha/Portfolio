import { loadEnv } from '../config/env.js';
import { createDb } from '../db/client.js';
import { AppError } from '../http/errors.js';
import { AdminService } from '../modules/auth/admin.service.js';
import { AuthRepository } from '../modules/auth/auth.repository.js';
import { askHidden, requireTerminal } from './prompt.js';

/*
 * Cambia la contraseña del administrador y revoca todas sus sesiones.
 * Uso en Docker: docker compose exec -it api node dist/cli/admin-password.js
 */
const db = createDb(loadEnv().DATABASE_URL);
try {
  requireTerminal();
  const password = await askHidden('Contraseña nueva: ');
  if (password !== (await askHidden('Repetí la contraseña: '))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Las contraseñas no coinciden');
  }
  const admin = await new AdminService(new AuthRepository(db)).changePassword(password);
  console.log(`Contraseña de "${admin.username}" cambiada. Todas las sesiones quedaron revocadas.`);
} catch (err) {
  console.error(`Error: ${err instanceof Error ? err.message : 'no se pudo cambiar'}`);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
