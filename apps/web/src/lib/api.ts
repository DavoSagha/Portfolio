import type {
  Home,
  Language,
  ProjectCard,
  ProjectDetail,
  SkillGroup,
  TimelineEntry,
} from './types';

/** URL de la API dentro de la red interna (Docker) o local en desarrollo. */
const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

/**
 * Las respuestas se cachean 60 s (D-005): los cambios del panel se ven en un minuto como
 * máximo, sin redesplegar, y la API no recibe una consulta por cada visita.
 */
const REVALIDATE_SECONDS = 60;

async function get<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${path} respondió ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  home: () => get<Home>('/public/home'),
  projects: async () => (await get<ProjectCard[]>('/public/projects')) ?? [],
  project: (slug: string) => get<ProjectDetail>(`/public/projects/${encodeURIComponent(slug)}`),
  timeline: async () => (await get<TimelineEntry[]>('/public/timeline')) ?? [],
  skills: async () => (await get<SkillGroup[]>('/public/skills')) ?? [],
  languages: async () => (await get<Language[]>('/public/languages')) ?? [],
};
