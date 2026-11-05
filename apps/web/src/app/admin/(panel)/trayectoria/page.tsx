import type { Metadata } from 'next';
import Link from 'next/link';
import { DeleteButton, MoveButtons } from '@/components/admin/fields';
import { SortByDateButton } from '@/components/admin/timeline-form';
import { ButtonLink } from '@/components/ui';
import { adminGet } from '@/lib/admin-server';
import type { AdminTimelineEntry } from '@/lib/admin-types';
import { TIMELINE_TYPE_LABEL } from '@/lib/format';

export const metadata: Metadata = { title: 'Trayectoria' };

export default async function AdminTimelinePage() {
  const entries = (await adminGet<AdminTimelineEntry[]>('/timeline')) ?? [];
  const ids = entries.map((entry) => entry.id);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Trayectoria</h1>
        <div className="flex flex-wrap gap-3">
          <SortByDateButton entries={entries} />
          <ButtonLink href="/admin/trayectoria/nuevo" variant="primary">
            Nueva entrada
          </ButtonLink>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">Se muestra en el sitio en este mismo orden.</p>
      <ul className="mt-6 space-y-3">
        {entries.map((entry, index) => {
          const title = entry.translations.es?.title ?? entry.organization;
          return (
            <li
              key={entry.id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface p-3"
            >
              <div className="min-w-48 flex-1">
                <p className="font-medium">
                  <Link href={`/admin/trayectoria/${entry.id}`}>{title}</Link>
                </p>
                <p className="text-sm text-muted">{entry.organization}</p>
                <p className="font-mono text-label text-muted">
                  {TIMELINE_TYPE_LABEL[entry.type]} · {entry.startDate.slice(0, 7)}
                  {!entry.published && ' · Oculta'}
                </p>
              </div>
              <MoveButtons reorderPath="/timeline/reorder" ids={ids} index={index} name={title} />
              <DeleteButton path={`/timeline/${entry.id}`} name={title} />
            </li>
          );
        })}
      </ul>
    </>
  );
}
