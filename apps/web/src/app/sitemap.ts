import type { MetadataRoute } from 'next';
import { api } from '@/lib/api';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

/** Solo rutas públicas con contenido publicado; el panel nunca aparece. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await api.projects().catch(() => []);
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    ...(projects.length > 0
      ? [{ url: `${SITE_URL}/proyectos`, changeFrequency: 'weekly' as const, priority: 0.8 }]
      : []),
    ...projects.map((p) => ({
      url: `${SITE_URL}/proyectos/${p.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
