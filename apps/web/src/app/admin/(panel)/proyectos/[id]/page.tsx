import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProjectForm } from '@/components/admin/project-form';
import { ProjectImages } from '@/components/admin/project-images';
import { adminGet } from '@/lib/admin-server';
import type { AdminProject, AdminSkill } from '@/lib/admin-types';

export const metadata: Metadata = { title: 'Editar proyecto' };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, skills] = await Promise.all([
    adminGet<AdminProject>(`/projects/${encodeURIComponent(id)}`),
    adminGet<AdminSkill[]>('/skills'),
  ]);
  if (!project) notFound();
  return (
    <>
      <p className="text-sm">
        <Link href="/admin/proyectos">← Proyectos</Link>
      </p>
      <h1 className="mt-2 text-2xl">{project.translations.es?.title ?? project.slug}</h1>
      <ul className="mt-2 flex flex-wrap gap-4 text-sm">
        <li>
          <Link href={`/admin/preview/projects/${project.id}`}>Previsualizar lo guardado</Link>
        </li>
        {project.status === 'PUBLISHED' && (
          <li>
            <Link href={`/proyectos/${project.slug}`}>Ver en el sitio</Link>
          </li>
        )}
      </ul>
      <div className="mt-6 grid gap-10 xl:grid-cols-[2fr_1fr]">
        <ProjectForm project={project} skills={skills ?? []} />
        <ProjectImages project={project} />
      </div>
    </>
  );
}
