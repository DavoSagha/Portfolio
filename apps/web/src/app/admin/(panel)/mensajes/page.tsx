import type { Metadata } from 'next';
import Link from 'next/link';
import { MessagesList } from '@/components/admin/messages-list';
import { adminGet } from '@/lib/admin-server';
import type { AdminMessagesPage } from '@/lib/admin-types';

export const metadata: Metadata = { title: 'Mensajes' };

const PAGE_SIZE = 20;

export default async function AdminMessages({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; cursor?: string }>;
}) {
  const { filtro, cursor } = await searchParams;
  const unreadOnly = filtro === 'sin-leer';
  const query = new URLSearchParams({ limit: String(PAGE_SIZE), unread: String(unreadOnly) });
  if (cursor) query.set('cursor', cursor);
  const page = await adminGet<AdminMessagesPage>(`/messages?${query}`);
  const base = unreadOnly ? '/admin/mensajes?filtro=sin-leer' : '/admin/mensajes';

  return (
    <>
      <h1 className="text-2xl">Mensajes</h1>
      <p className="mt-2 text-sm text-muted">
        {page?.unreadCount ?? 0} sin leer ·{' '}
        <Link href={unreadOnly ? '/admin/mensajes' : '/admin/mensajes?filtro=sin-leer'}>
          {unreadOnly ? 'Ver todos' : 'Ver solo los no leídos'}
        </Link>
      </p>
      <div className="mt-6">
        {page && page.items.length > 0 ? (
          <MessagesList messages={page.items} />
        ) : (
          <p className="text-muted">No hay mensajes para mostrar.</p>
        )}
      </div>
      {(cursor || page?.nextCursor) && (
        <ul className="mt-6 flex gap-4 text-sm">
          {cursor && (
            <li>
              <Link href={base}>Volver a los más recientes</Link>
            </li>
          )}
          {page?.nextCursor && (
            <li>
              <Link
                href={`${base}${base.includes('?') ? '&' : '?'}cursor=${encodeURIComponent(page.nextCursor)}`}
              >
                Mensajes anteriores
              </Link>
            </li>
          )}
        </ul>
      )}
    </>
  );
}
