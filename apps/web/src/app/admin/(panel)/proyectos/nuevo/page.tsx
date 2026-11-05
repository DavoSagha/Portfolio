import type { Metadata } from 'next';
import { ProjectForm } from '@/components/admin/project-form';
import { adminGet } from '@/lib/admin-server';
import type { AdminSkill } from '@/lib/admin-types';

export const metadata: Metadata = { title: 'Nuevo proyecto' };

export default async function NewProjectPage() {
  const skills = (await adminGet<AdminSkill[]>('/skills')) ?? [];
  return (
    <>
      <h1 className="text-2xl">Nuevo proyecto</h1>
      <p className="mt-2 text-sm text-muted">Las imágenes se agregan después de crearlo.</p>
      <div className="mt-6 max-w-prose">
        <ProjectForm skills={skills} />
      </div>
    </>
  );
}
