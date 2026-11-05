import type { Metadata } from 'next';
import { ProjectCard } from '@/components/project-card';
import { Container, MonoLabel } from '@/components/ui';
import { api } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Proyectos',
  alternates: { canonical: '/proyectos' },
};

export default async function ProjectsPage() {
  const projects = await api.projects();
  return (
    <Container className="py-12 sm:py-16">
      <MonoLabel>Proyectos</MonoLabel>
      <h1 className="mt-2 text-3xl sm:text-4xl">Proyectos</h1>
      {projects.length === 0 ? (
        <p className="mt-8 text-muted">Todavía no hay proyectos publicados.</p>
      ) : (
        <ul className="mt-10 grid gap-6 md:grid-cols-2">
          {projects.map((p) => (
            <li key={p.slug}>
              <ProjectCard project={p} headingLevel={2} />
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
