import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProjectKind, ProjectLinks, ProjectStack } from '@/components/project-card';
import { Text } from '@/components/text';
import { Container, Notice } from '@/components/ui';
import { api } from '@/lib/api';
import { formatRange } from '@/lib/format';
import type { ProjectDetail } from '@/lib/types';

type Props = { params: Promise<{ slug: string }> };

const SECTIONS: { key: keyof ProjectDetail; title: string }[] = [
  { key: 'context', title: 'Contexto' },
  { key: 'problem', title: 'Problema' },
  { key: 'solution', title: 'Solución' },
  { key: 'architecture', title: 'Arquitectura' },
  { key: 'decisions', title: 'Decisiones' },
  { key: 'challenges', title: 'Dificultades' },
  { key: 'learnings', title: 'Aprendizajes' },
  { key: 'limitations', title: 'Limitaciones' },
];

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

  const dates = formatRange(project.startDate, project.endDate);
  return (
    <Container className="py-12 sm:py-16">
      <p className="text-sm">
        <Link href="/proyectos">← Todos los proyectos</Link>
      </p>
      <article className="mt-6 max-w-prose">
        <ProjectKind team={project.team} origin={project.origin} inProgress={project.inProgress} />
        <h1 className="mt-2 text-3xl sm:text-4xl">{project.title}</h1>
        {dates && <p className="mt-2 font-mono text-label text-muted">{dates}</p>}
        <p className="mt-4 text-lg">
          <Text value={project.summary} />
        </p>
        {project.disclaimer && (
          <div className="mt-6">
            <Notice>{project.disclaimer}</Notice>
          </div>
        )}

        {(project.role || project.stack.length > 0) && (
          <dl className="mt-8 space-y-4">
            {project.role && (
              <div>
                <dt className="font-medium">Mi aporte</dt>
                <dd className="text-muted">
                  <Text value={project.role} />
                </dd>
              </div>
            )}
            {project.stack.length > 0 && (
              <div>
                <dt className="font-medium">Tecnologías</dt>
                <dd>
                  <ProjectStack stack={project.stack} className="mt-2" />
                </dd>
              </div>
            )}
          </dl>
        )}

        <div className="mt-6">
          <ProjectLinks demoUrl={project.demoUrl} repoUrl={project.repoUrl} />
        </div>

        {SECTIONS.map(({ key, title }) => {
          const value = project[key];
          // Una sección sin contenido no se muestra.
          if (typeof value !== 'string' || value.trim().length === 0) return null;
          return (
            <section key={key} className="mt-10">
              <h2 className="text-xl">{title}</h2>
              <p className="mt-3">
                <Text value={value} />
              </p>
            </section>
          );
        })}

        {project.images.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl">Imágenes</h2>
            <ul className="mt-4 grid gap-4">
              {project.images.map((img) => (
                <li key={img.url}>
                  <Image
                    src={img.url}
                    alt={img.alt}
                    width={1200}
                    height={750}
                    unoptimized
                    className="h-auto w-full rounded-md border border-border"
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </Container>
  );
}
