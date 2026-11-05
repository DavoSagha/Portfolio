import type { DatePrecision, ProjectOrigin, ProjectTeam, SkillLevel, TimelineType } from './types';

const monthYear = new Intl.DateTimeFormat('es-AR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatDate(value: string, precision: DatePrecision = 'MONTH'): string {
  const date = new Date(`${value}T00:00:00Z`);
  return precision === 'YEAR' ? String(date.getUTCFullYear()) : monthYear.format(date);
}

/** "marzo de 2026 – actualidad", "2023", "marzo de 2023 – diciembre de 2023". */
export function formatRange(
  start: string | null,
  end: string | null,
  precision: DatePrecision = 'MONTH',
  { ongoingIfNoEnd = true } = {},
): string | null {
  if (!start) return null;
  const from = formatDate(start, precision);
  if (!end) return ongoingIfNoEnd ? `${from} – actualidad` : from;
  const to = formatDate(end, precision);
  return from === to ? from : `${from} – ${to}`;
}

export const TEAM_LABEL: Record<ProjectTeam, string> = {
  INDIVIDUAL: 'Individual',
  GROUP: 'Grupal',
};
export const ORIGIN_LABEL: Record<ProjectOrigin, string> = {
  ACADEMIC: 'Académico',
  PERSONAL: 'Personal',
  PROFESSIONAL: 'Profesional',
};
export const SKILL_LEVEL_LABEL: Record<SkillLevel, string> = {
  BASIC: 'Básico',
  INTERMEDIATE: 'Intermedio',
  SOLID: 'Sólido',
};
export const TIMELINE_TYPE_LABEL: Record<TimelineType, string> = {
  EXPERIENCE: 'Experiencia',
  EDUCATION: 'Educación',
  CERTIFICATION: 'Certificación',
};
export const languageLevelLabel = (level: string) => (level === 'NATIVE' ? 'Nativo' : level);
