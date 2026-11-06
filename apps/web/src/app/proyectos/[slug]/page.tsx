import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/breadcrumb';
import { ProjectDetailView } from '@/components/project-detail';
import { Container } from '@/components/ui';
import { api } from '@/lib/api';

type Props = { params: Promise<{ slug: string }> };

const isSlug = (slug: string) => /^[a-z0-9-]{1,100}$/.test(slug);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = isSlug(slug) ? await api.project(slug) : null;
  if (!project) return { title: 'Proyecto no encontrado' };
  return {
    title: project.title,
    description: project.summary,
    alternates: { canonical: `/proyectos/${project.slug}` },
    openGraph: {
      title: project.title,
      description: project.summary,
      ...(project.coverUrl ? { images: [{ url: project.coverUrl }] } : {}),
    },
  };
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = isSlug(slug) ? await api.project(slug) : null;
  if (!project) notFound();

  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumb
        items={[
          { href: '/', label: 'Inicio' },
          { href: '/proyectos', label: 'Proyectos' },
        ]}
        current={project.title}
      />
      <ProjectDetailView project={project} />
    </Container>
  );
}
