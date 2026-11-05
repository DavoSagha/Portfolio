import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

export type Db = PrismaClient;

export function createDb(databaseUrl: string): Db {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  // minimal: los errores que llegan al log no incluyen fragmentos de la consulta ni sus datos.
  return new PrismaClient({ adapter, errorFormat: 'minimal' });
}
