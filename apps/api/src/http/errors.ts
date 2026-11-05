import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'CSRF_INVALID'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
    /** Segundos para reintentar; se envía en la cabecera Retry-After. */
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (message = 'Recurso no encontrado') =>
  new AppError(404, 'NOT_FOUND', message);

/** Mismo mensaje para cualquier fallo de credenciales: no dice cuál de los dos datos falló. */
export const invalidCredentials = () =>
  new AppError(401, 'UNAUTHENTICATED', 'Usuario o contraseña incorrectos');

/** Sin sesión válida. No aclara si falta, venció o fue revocada. */
export const unauthenticated = () => new AppError(401, 'UNAUTHENTICATED', 'Sesión no válida');

export const csrfInvalid = () => new AppError(403, 'CSRF_INVALID', 'Token CSRF inválido');

export const tooManyAttempts = (retryAfterSeconds: number) =>
  new AppError(
    429,
    'RATE_LIMITED',
    'Demasiados intentos. Probá más tarde.',
    undefined,
    retryAfterSeconds,
  );

const PRISMA_CONFLICT_CODES = new Set(['P2002', 'P2003', 'P2014']);

/** Errores conocidos de Prisma y de multer, sin exponer nombres de tablas ni de columnas. */
function knownLibraryError(err: unknown): AppError | null {
  if (typeof err !== 'object' || err === null) return null;
  const { code, name } = err as { code?: unknown; name?: unknown };
  if (name === 'MulterError') {
    return code === 'LIMIT_FILE_SIZE'
      ? new AppError(413, 'FILE_TOO_LARGE', 'El archivo supera los 5 MB')
      : new AppError(400, 'VALIDATION_ERROR', 'Formulario de archivo inválido');
  }
  if (name !== 'PrismaClientKnownRequestError' || typeof code !== 'string') return null;
  if (code === 'P2025') return notFound();
  if (code === 'P2002') return new AppError(409, 'CONFLICT', 'Ya existe un elemento con ese valor');
  if (PRISMA_CONFLICT_CODES.has(code)) {
    return new AppError(409, 'CONFLICT', 'El elemento está en uso o referencia a otro inexistente');
  }
  return null;
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(notFound('Ruta no encontrada'));
};

export const errorHandler: ErrorRequestHandler = (rawErr, _req, res, _next) => {
  const err: unknown = knownLibraryError(rawErr) ?? rawErr;
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos inválidos',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }
  if (err instanceof AppError) {
    if (err.retryAfterSeconds) res.set('Retry-After', String(err.retryAfterSeconds));
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }
  // JSON mal formado que rechaza express.json()
  if (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    err.type === 'entity.parse.failed'
  ) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'JSON inválido' } });
    return;
  }
  // El detalle va solo al log, nunca a la respuesta.
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno' } });
};
