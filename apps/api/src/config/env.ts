import { z } from 'zod';

const DEV_PASSWORD = 'portfolio';
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);
const optionalText = z.preprocess(emptyToUndefined, z.string().min(1).optional());

const envSchema = z
  .object({
    APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    SITE_URL: z.url().default('http://localhost:8080'),
    UPLOADS_DIR: z.string().min(1).default('./uploads'),
    // SMTP (D-019). Opcional: sin él, los mensajes se guardan pero no llegan por email.
    SMTP_HOST: optionalText,
    SMTP_PORT: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).max(65535).default(587),
    ),
    SMTP_USER: optionalText,
    SMTP_PASS: optionalText,
    SMTP_FROM: optionalText,
    CONTACT_TO: z.preprocess(emptyToUndefined, z.email().optional()),
  })
  .superRefine((env, ctx) => {
    // Todo o nada: una configuración a medias fallaría recién al llegar el primer mensaje.
    const smtp = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'CONTACT_TO'] as const;
    if (smtp.some((key) => env[key]) && !smtp.every((key) => env[key])) {
      for (const key of smtp.filter((name) => !env[name])) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'falta para completar el SMTP' });
      }
    }
    if (env.APP_ENV !== 'production') return;
    const dbPassword = decodeURIComponent(new URL(env.DATABASE_URL).password);
    if (dbPassword === '' || dbPassword === DEV_PASSWORD) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'en producción no se permite la contraseña de ejemplo ni una vacía',
      });
    }
    if (!env.SITE_URL.startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['SITE_URL'],
        message: 'en producción debe usar https',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Valida las variables al iniciar. Si falta o es inválida alguna, el proceso no arranca.
 * El mensaje nombra la variable pero nunca muestra su valor.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${problems}`);
  }
  return result.data;
}
