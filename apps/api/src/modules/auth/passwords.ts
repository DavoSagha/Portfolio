import argon2 from 'argon2';

// Argon2id con los parámetros mínimos que recomienda OWASP: 19 MiB, 2 pasadas, 1 hilo.
const OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const MIN_PASSWORD_LENGTH = 12;
/** Igual al máximo que acepta el login: una contraseña más larga nunca podría entrar. */
export const MAX_PASSWORD_LENGTH = 1024;

let dummy: Promise<string> | undefined;

/**
 * Objeto y no funciones sueltas: las pruebas pueden espiar cuántas veces corre Argon2.
 * El hash incluye su sal y sus parámetros, por eso `verify` no necesita nada más.
 */
export const passwords = {
  hash: (plain: string) => argon2.hash(plain, OPTIONS),

  verify: (hash: string, plain: string) => argon2.verify(hash, plain),

  /** Hash de un valor aleatorio, con el mismo costo que uno real. Nunca coincide con nada útil. */
  dummyHash: () => (dummy ??= argon2.hash(crypto.randomUUID(), OPTIONS)),
};
