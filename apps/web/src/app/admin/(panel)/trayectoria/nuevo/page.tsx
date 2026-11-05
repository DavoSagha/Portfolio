import type { Metadata } from 'next';
import { TimelineForm } from '@/components/admin/timeline-form';
import { adminGet } from '@/lib/admin-server';
import type { AdminProject } from '@/lib/admin-types';

export const metadata: Metadata = { title: 'Nueva entrada' };

export default async function NewTimelinePage() {
  const projects = (await adminGet<AdminProject[]>('/projects')) ?? [];
  return (
    <>
      <h1 className="text-2xl">Nueva entrada</h1>
      <div className="mt-6 max-w-prose">
        <TimelineForm
          projects={projects.map((p) => ({ id: p.id, title: p.translations.es?.title ?? p.slug }))}
        />
      </div>
    </>
  );
}
