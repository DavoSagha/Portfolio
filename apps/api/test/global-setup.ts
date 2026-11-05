import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { assertTestDatabase } from './helpers/db.js';

/** Aplica las migraciones a la base de tests una vez antes de toda la suite. */
export default function setup() {
  const url = process.env.DATABASE_URL;
  assertTestDatabase(url);
  // Se ejecuta el CLI de Prisma con el mismo Node, sin shell (portable y sin interpolar argumentos).
  const require = createRequire(import.meta.url);
  const prismaCli = path.join(
    path.dirname(require.resolve('prisma/package.json')),
    'build/index.js',
  );
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
