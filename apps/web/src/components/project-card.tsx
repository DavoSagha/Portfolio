import Link from 'next/link';
import { ORIGIN_LABEL, TEAM_LABEL } from '@/lib/format';
import type { ProjectCard as ProjectCardData } from '@/lib/types';
import { Text } from './text';
import { Chip, Notice } from './ui';

/** "GRUPAL · PERSONAL"; si falta un dato, lo muestra como pendiente en vez de suponerlo. */
export function ProjectKind({ team, origin }: Pick<ProjectCardData, 'team' | 'origin'>) {
  return (
    <p className="font-mono text-label tracking-(--text-label--letter-spacing) text-muted uppercase">
      {team ? TEAM_LABEL[team] : <Text value="TODO: equipo" />}
      <span aria-hidden="true"> · </span>
      {origin ? ORIGIN_LABEL[origin] : <Text value="TODO: origen" />}
    </p>
  );
}

export function ProjectLinks({ demoUrl, repoUrl }: Pick<ProjectCardData, 'demoUrl' | 'repoUrl'>) {
  if (!demoUrl && !repoUrl) return null;
  return (
    <ul className="flex flex-wrap gap-4 text-sm">
      {demoUrl && (
        <li>
          <a href={demoUrl} rel="noopener" target="_blank">
            Ver demo<span className="sr-only"> (abre en otra pestaña)</span>
          </a>
        </li>
      )}
      {repoUrl && (
        <li>
          <a href={repoUrl} rel="noopener" target="_blank">
            Ver código<span className="sr-only"> (abre en otra pestaña)</span>
          </a>
        </li>
      )}
    </ul>
  );
}

export function ProjectCard({
  project,
  headingLevel = 3,
}: {
  project: ProjectCardData;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <article className="flex h-full flex-col gap-3 rounded-md border border-border bg-surface p-5">
      <ProjectKind team={project.team} origin={project.origin} />
      <Heading className="text-xl">
        <Link href={`/proyectos/${project.slug}`} className="text-text hover:text-accent">
          {project.title}
        </Link>
      </Heading>
      {project.disclaimer && <Notice>{project.disclaimer}</Notice>}
      <p>
        <Text value={project.summary} />
      </p>
      <div className="text-sm text-muted">
        <span className="font-medium text-text">Mi rol: </span>
        <Text value={project.role} />
      </div>
      {project.skills.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Tecnologías">
          {project.skills.map((s) => (
            <Chip key={s.name}>{s.name}</Chip>
          ))}
        </ul>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
        <Link href={`/proyectos/${project.slug}`} className="text-sm">
          Ver detalle<span className="sr-only"> de {project.title}</span>
        </Link>
        <ProjectLinks demoUrl={project.demoUrl} repoUrl={project.repoUrl} />
      </div>
    </article>
  );
}
