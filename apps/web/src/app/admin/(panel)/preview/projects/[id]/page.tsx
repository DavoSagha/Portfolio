import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProjectDetailView } from '@/components/project-detail';
import { Notice } from '@/components/ui';
import { adminGet } from '@/lib/admin-server';
import type { ProjectDetail } from '@/lib/types';

export const metadata: Metadata = { title: 'Previsualización' };

/** El mismo componente que el sitio público, con cualquier estado (D-021). */
export default async function PreviewProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await adminGet<ProjectDetail>(`/projects/${encodeURIComponent(id)}/preview`);
  if (!project) notFound();
  return (
    <>
      <p className="text-sm">
        <Link href={`/admin/proyectos/${encodeURIComponent(id)}`}>← Volver a editar</Link>
      </p>
      <div className="mt-4">
        <Notice>Previsualización: así se ve lo último guardado.</Notice>
      </div>
      <ProjectDetailView project={project} />
    </>
  );
}
