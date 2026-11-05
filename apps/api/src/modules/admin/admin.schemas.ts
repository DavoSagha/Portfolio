import { z } from 'zod';

/*
 * Contratos de escritura del panel (docs/api.md). Zod descarta las claves que no están
 * declaradas: el cliente no puede escribir campos internos como `createdAt` o `order`.
 *
 * Cada traducción es un objeto completo: los textos opcionales que faltan quedan vacíos.
 */

const trimmed = (value: unknown) => (typeof value === 'string' ? value.trim() : value);
const emptyToNull = (value: unknown) => {
  const v = trimmed(value);
  return v === '' ? null : v;
};

const requiredText = (max: number) => z.string().trim().min(1, 'No puede estar vacío').max(max);
const blankableText = (max: number) => z.string().trim().max(max).default('');
/** Un texto vacío se guarda como null y no se muestra. */
const optionalText = (max = 20_000) =>
  z.preprocess(emptyToNull, z.string().max(max).nullable().default(null));

/**
 * Solo http y https. Un link se renderiza como href: `javascript:` sería un XSS guardado.
 * Vacío = null, y un link en null no se muestra.
 */
const optionalUrl = z.preprocess(
  emptyToNull,
  z
    .url({ protocol: /^https?$/, error: 'Debe ser una URL http o https' })
    .max(2000)
    .nullable(),
);

const optionalDate = z.preprocess(
  emptyToNull,
  z.iso
    .date('Debe ser una fecha AAAA-MM-DD')
    .transform((value) => new Date(`${value}T00:00:00Z`))
    .nullable(),
);

const translationsOf = <T extends z.ZodType>(schema: T) =>
  z.partialRecord(z.enum(['es', 'en', 'fr']), schema);

const withSpanish = <T extends z.ZodType>(schema: T) =>
  translationsOf(schema).refine((t) => t.es !== undefined, {
    message: 'Falta la traducción en español',
    path: ['es'],
  });

const endNotBeforeStart = (
  value: { startDate?: Date | null; endDate?: Date | null },
  ctx: z.RefinementCtx,
) => {
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'No puede ser anterior a la fecha de inicio',
    });
  }
};

export const idParams = z.object({ id: z.string().regex(/^[a-z0-9]{20,40}$/) });
export const reorderSchema = z.object({
  ids: z
    .array(z.string().regex(/^[a-z0-9]{20,40}$/))
    .min(1)
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, 'Hay ids repetidos'),
});

// ── Perfil ─────────────────────────────────────────────────────

const profileTranslation = z.object({
  headline: requiredText(200),
  valueProp: blankableText(500),
  summary: blankableText(2000),
  availability: blankableText(300),
});

export const profileSchema = z.object({
  fullName: requiredText(120),
  location: requiredText(120),
  linkedinUrl: optionalUrl.default(null),
  githubUrl: optionalUrl.default(null),
  publicEmail: z.preprocess(
    emptyToNull,
    z.email('Email inválido').max(254).nullable().default(null),
  ),
  showEmail: z.boolean(),
  translations: withSpanish(profileTranslation),
});

// ── Skills ─────────────────────────────────────────────────────

export const skillCategorySchema = z.object({
  published: z.boolean().default(true),
  translations: withSpanish(z.object({ name: requiredText(100) })),
});
export const skillCategoryPatchSchema = skillCategorySchema.partial();

const skillFields = {
  categoryId: z.string().regex(/^[a-z0-9]{20,40}$/),
  name: requiredText(100),
  level: z.preprocess(emptyToNull, z.enum(['BASIC', 'INTERMEDIATE', 'SOLID']).nullable()),
  published: z.boolean(),
  projectIds: z.array(z.string().regex(/^[a-z0-9]{20,40}$/)).max(100),
};
export const skillSchema = z.object({
  ...skillFields,
  level: skillFields.level.default(null),
  published: skillFields.published.default(false),
  projectIds: skillFields.projectIds.default([]),
});
export const skillPatchSchema = z.object(skillFields).partial();

// ── Proyectos ──────────────────────────────────────────────────

const projectTranslation = z.object({
  title: requiredText(200),
  summary: requiredText(1000),
  role: blankableText(5000),
  context: optionalText(),
  problem: optionalText(),
  solution: optionalText(),
  architecture: optionalText(),
  decisions: optionalText(),
  challenges: optionalText(),
  learnings: optionalText(),
  limitations: optionalText(),
  disclaimer: optionalText(1000),
  /** Por ejemplo, que la demo puede tardar en cargar por estar en un hosting gratuito. */
  demoNote: optionalText(300),
});

const projectFields = {
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones')
    .max(100),
  status: z.enum(['DRAFT', 'PUBLISHED']),
  featured: z.boolean(),
  inProgress: z.boolean(),
  team: z.preprocess(emptyToNull, z.enum(['INDIVIDUAL', 'GROUP']).nullable()),
  origin: z.preprocess(emptyToNull, z.enum(['ACADEMIC', 'PERSONAL', 'PROFESSIONAL']).nullable()),
  startDate: optionalDate,
  endDate: optionalDate,
  stack: z.array(requiredText(100)).max(40),
  demoUrl: optionalUrl,
  repoUrl: optionalUrl,
  skillIds: z.array(z.string().regex(/^[a-z0-9]{20,40}$/)).max(100),
};

export const projectSchema = z
  .object({
    ...projectFields,
    status: projectFields.status.default('DRAFT'),
    featured: projectFields.featured.default(false),
    inProgress: projectFields.inProgress.default(false),
    team: projectFields.team.default(null),
    origin: projectFields.origin.default(null),
    startDate: projectFields.startDate.default(null),
    endDate: projectFields.endDate.default(null),
    stack: projectFields.stack.default([]),
    demoUrl: projectFields.demoUrl.default(null),
    repoUrl: projectFields.repoUrl.default(null),
    skillIds: projectFields.skillIds.default([]),
    translations: withSpanish(projectTranslation),
  })
  .superRefine(endNotBeforeStart);

export const projectPatchSchema = z
  .object({ ...projectFields, translations: translationsOf(projectTranslation) })
  .partial()
  .superRefine(endNotBeforeStart);

export const imageFieldsSchema = z.object({
  alt: requiredText(300),
  locale: z.enum(['es', 'en', 'fr']).default('es'),
});

// ── Trayectoria ────────────────────────────────────────────────

const timelineTranslation = z.object({
  title: requiredText(200),
  description: optionalText(5000),
});

const timelineFields = {
  type: z.enum(['EXPERIENCE', 'EDUCATION', 'CERTIFICATION']),
  organization: requiredText(200),
  startDate: z.iso
    .date('Debe ser una fecha AAAA-MM-DD')
    .transform((value) => new Date(`${value}T00:00:00Z`)),
  endDate: optionalDate,
  datePrecision: z.enum(['MONTH', 'YEAR']),
  credentialUrl: optionalUrl,
  relatedProjectId: z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(/^[a-z0-9]{20,40}$/)
      .nullable(),
  ),
  published: z.boolean(),
};

export const timelineSchema = z
  .object({
    ...timelineFields,
    endDate: timelineFields.endDate.default(null),
    datePrecision: timelineFields.datePrecision.default('MONTH'),
    credentialUrl: timelineFields.credentialUrl.default(null),
    relatedProjectId: timelineFields.relatedProjectId.default(null),
    published: timelineFields.published.default(true),
    translations: withSpanish(timelineTranslation),
  })
  .superRefine(endNotBeforeStart);

export const timelinePatchSchema = z
  .object({ ...timelineFields, translations: translationsOf(timelineTranslation) })
  .partial()
  .superRefine(endNotBeforeStart);

// ── Idiomas ────────────────────────────────────────────────────

const languageFields = {
  code: z
    .string()
    .trim()
    .regex(/^[a-z]{2,3}$/, 'Código de 2 o 3 letras minúsculas'),
  level: z.enum(['NATIVE', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
  published: z.boolean(),
};
export const languageSchema = z.object({
  ...languageFields,
  published: languageFields.published.default(true),
  translations: withSpanish(z.object({ name: requiredText(100) })),
});
export const languagePatchSchema = z
  .object({
    ...languageFields,
    translations: translationsOf(z.object({ name: requiredText(100) })),
  })
  .partial();

// ── CV ─────────────────────────────────────────────────────────

const cvProfile = z
  .enum(['backend', 'mainframe', 'soporte'])
  .transform((p) => p.toUpperCase() as 'BACKEND' | 'MAINFRAME' | 'SOPORTE');

export const cvUploadSchema = z.object({
  profile: cvProfile,
  label: requiredText(100),
  // Un formulario multipart manda texto, no booleanos.
  makeCurrent: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});
export const cvProfileParams = z.object({ profile: cvProfile });
export const cvPrimarySchema = z.object({ profile: cvProfile });
export const cvCurrentSchema = z.object({ versionId: z.string().regex(/^[a-z0-9]{20,40}$/) });
