import { z } from 'zod';
import type { Locale } from '../generated/prisma/enums.js';

export const DEFAULT_LOCALE: Locale = 'es';

export const localeQuerySchema = z.object({
  locale: z.enum(['es', 'en', 'fr']).default(DEFAULT_LOCALE),
});

/** Devuelve la traducción pedida, o la del idioma por defecto si no existe. */
export function pickTranslation<T extends { locale: Locale }>(
  translations: T[],
  locale: Locale,
): T | undefined {
  return (
    translations.find((t) => t.locale === locale) ??
    translations.find((t) => t.locale === DEFAULT_LOCALE) ??
    translations[0]
  );
}

/** Fecha de calendario (@db.Date) como YYYY-MM-DD. */
export const toDateString = (date: Date | null): string | null =>
  date ? date.toISOString().slice(0, 10) : null;
