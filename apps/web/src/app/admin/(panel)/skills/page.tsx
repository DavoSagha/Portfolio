import type { Metadata } from 'next';
import { SkillsEditor } from '@/components/admin/skills-editor';
import { adminGet } from '@/lib/admin-server';
import type { AdminCategory, AdminSkill } from '@/lib/admin-types';

export const metadata: Metadata = { title: 'Skills' };

export default async function AdminSkillsPage() {
  const [categories, skills] = await Promise.all([
    adminGet<AdminCategory[]>('/skill-categories'),
    adminGet<AdminSkill[]>('/skills'),
  ]);
  return (
    <>
      <h1 className="text-2xl">Skills</h1>
      <p className="mt-2 text-sm text-muted">
        Una skill sin nivel no se puede publicar. Los proyectos en los que se usa se eligen al
        editar cada proyecto.
      </p>
      <div className="mt-6">
        <SkillsEditor categories={categories ?? []} skills={skills ?? []} />
      </div>
    </>
  );
}
