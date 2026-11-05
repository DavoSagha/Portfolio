import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TimelineForm } from '@/components/admin/timeline-form';
import { adminGet } from '@/lib/admin-server';
import type { AdminProject, AdminTimelineEntry } from '@/lib/admin-types';

export const metadata: Metadata = { title: 'Editar entrada' };

export default async function EditTimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [entry, projects] = await Promise.all([
    adminGet<AdminTimelineEntry>(`/timeline/${encodeURIComponent(id)}`),
    adminGet<AdminProject[]>('/projects'),
  ]);
  if (!entry) notFound();
  return (
    <>
      <p className="text-sm">
        <Link href="/admin/trayectoria">← Trayectoria</Link>
      </p>
      <h1 className="mt-2 text-2xl">{entry.translations.es?.title ?? entry.organization}</h1>
      <div className="mt-6 max-w-prose">
        <TimelineForm
          entry={entry}
          projects={(projects ?? []).map((p) => ({
            id: p.id,
            title: p.translations.es?.title ?? p.slug,
          }))}
        />
      </div>
    </>
  );
}
