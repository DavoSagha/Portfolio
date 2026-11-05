import type { Metadata } from 'next';
import Link from 'next/link';
import { DeleteButton, MoveButtons } from '@/components/admin/fields';
import { ButtonLink } from '@/components/ui';
import { adminGet } from '@/lib/admin-server';
import type { AdminProject } from '@/lib/admin-types';

export const metadata: Metadata = { title: 'Proyectos' };

export default async function AdminProjectsPage() {
  const projects = (await adminGet<AdminProject[]>('/projects')) ?? [];
  const ids = projects.map((project) => project.id);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Proyectos</h1>
        <ButtonLink href="/admin/proyectos/nuevo" variant="primary">
          Nuevo proyecto
        </ButtonLink>
      </div>
      <ul className="mt-6 space-y-3">
        {projects.map((project, index) => {
          const title = project.translations.es?.title ?? project.slug;
          return (
            <li
              key={project.id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface p-3"
            >
              <div className="min-w-48 flex-1">
                <p className="font-medium">
                  <Link href={`/admin/proyectos/${project.id}`}>{title}</Link>
                </p>
                <p className="font-mono text-label text-muted">
                  {project.status === 'PUBLISHED' ? 'Publicado' : 'Borrador'}
                  {project.featured && ' · Destacado'}
                  {project.inProgress && ' · En desarrollo'}
                </p>
              </div>
              <MoveButtons reorderPath="/projects/reorder" ids={ids} index={index} name={title} />
              <DeleteButton path={`/projects/${project.id}`} name={title} />
            </li>
          );
        })}
      </ul>
    </>
  );
}
