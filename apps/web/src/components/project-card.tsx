import Link from 'next/link';
import { ORIGIN_LABEL, TEAM_LABEL } from '@/lib/format';
import type { ProjectCard as ProjectCardData } from '@/lib/types';
import { Text } from './text';
import { Chip, Notice } from './ui';

/** "GRUPAL · PERSONAL · EN DESARROLLO". Un dato que falta no se muestra ni se supone. */
export function ProjectKind({
  team,
  origin,
  inProgress,
}: Pick<ProjectCardData, 'team' | 'origin' | 'inProgress'>) {
  const parts = [
    team && TEAM_LABEL[team],
    origin && ORIGIN_LABEL[origin],
    inProgress && 'En desarrollo',
  ].filter((part): part is string => Boolean(part));
  if (parts.length === 0) return null;
  return (
    <p className="font-mono text-label tracking-(--text-label--letter-spacing) text-muted uppercase">
      {parts.map((part, i) => (
        <span key={part}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          {part}
        </span>
      ))}
    </p>
  );
}

/** Tecnologías del proyecto, en el orden cargado. */
export function ProjectStack({ stack, className }: { stack: string[]; className?: string }) {
  if (stack.length === 0) return null;
  return (
    <ul className={`flex flex-wrap gap-2 ${className ?? ''}`} aria-label="Tecnologías">
      {stack.map((tech) => (
        <Chip key={tech}>{tech}</Chip>
      ))}
    </ul>
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
      <ProjectKind team={project.team} origin={project.origin} inProgress={project.inProgress} />
      <Heading className="text-xl">
        <Link href={`/proyectos/${project.slug}`} className="text-text hover:text-accent">
          {project.title}
        </Link>
      </Heading>
      {project.disclaimer && <Notice>{project.disclaimer}</Notice>}
      <p>
        <Text value={project.summary} />
      </p>
      {project.role && (
        <div className="text-sm text-muted">
          <span className="font-medium text-text">Mi aporte: </span>
          <Text value={project.role} />
        </div>
      )}
      <ProjectStack stack={project.stack} />
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
        <Link href={`/proyectos/${project.slug}`} className="text-sm">
          Ver detalle<span className="sr-only"> de {project.title}</span>
        </Link>
        <ProjectLinks demoUrl={project.demoUrl} repoUrl={project.repoUrl} />
      </div>
    </article>
  );
}
