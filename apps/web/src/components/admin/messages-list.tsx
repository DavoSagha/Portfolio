'use client';

import { adminRequest } from '@/lib/admin-client';
import type { AdminMessage } from '@/lib/admin-types';
import { ActionMessage, Button, DeleteButton, useAction } from './fields';

const dateFormat = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Argentina/Buenos_Aires',
});

function emailState(message: AdminMessage) {
  if (message.emailSentAt) return 'Enviado por email';
  if (message.emailError) return `No se pudo enviar por email: ${message.emailError}`;
  return 'Envío por email pendiente';
}

function MessageItem({ message }: { message: AdminMessage }) {
  const { run, status, pending } = useAction();
  const isRead = message.readAt !== null;
  return (
    <li
      className={`space-y-3 rounded-md border bg-surface p-4 ${
        isRead ? 'border-border' : 'border-border-strong'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="text-base">
          {message.name}
          {!isRead && <span className="ml-2 text-sm font-normal text-secondary">Sin leer</span>}
        </h2>
        <p className="font-mono text-label text-muted">
          {dateFormat.format(new Date(message.createdAt))}
        </p>
      </div>
      <p className="text-sm">
        <a href={`mailto:${message.email}`}>{message.email}</a>
      </p>
      {/* Texto de un tercero: React lo escapa, y nunca se interpreta como HTML. */}
      <p className="break-words whitespace-pre-line">{message.body}</p>
      <p className="text-sm text-muted">{emailState(message)}</p>
      <ActionMessage status={status?.kind === 'error' ? status : null} />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          aria-label={`Marcar como ${isRead ? 'no leído' : 'leído'} el mensaje de ${message.name}`}
          onClick={() =>
            run(() =>
              adminRequest(`/messages/${message.id}`, {
                method: 'PATCH',
                json: { read: !isRead },
              }),
            )
          }
        >
          {isRead ? 'Marcar como no leído' : 'Marcar como leído'}
        </Button>
        <DeleteButton path={`/messages/${message.id}`} name={`el mensaje de ${message.name}`} />
      </div>
    </li>
  );
}

export function MessagesList({ messages }: { messages: AdminMessage[] }) {
  return (
    <ul className="space-y-4">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
    </ul>
  );
}
