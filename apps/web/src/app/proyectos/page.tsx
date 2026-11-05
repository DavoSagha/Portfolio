import type { Metadata } from 'next';
import { PaginatedProjectList } from '@/components/paginated-project-list';
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
      <h1 id="proyectos-title" className="mt-2 text-3xl sm:text-4xl">
        Proyectos
      </h1>
      {projects.length === 0 ? (
        <p className="mt-8 text-muted">Todavía no hay proyectos publicados.</p>
      ) : (
        // Todas las tarjetas se renderizan en el servidor; el componente de cliente solo pagina.
        <PaginatedProjectList
          labelledBy="proyectos-title"
          items={projects.map((p) => ({
            key: p.slug,
            node: <ProjectCard project={p} headingLevel={2} />,
          }))}
        />
      )}
    </Container>
  );
}
