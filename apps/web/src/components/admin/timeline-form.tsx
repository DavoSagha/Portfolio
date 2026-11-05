'use client';

import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { adminRequest } from '@/lib/admin-client';
import type { AdminTimelineEntry } from '@/lib/admin-types';
import {
  ActionMessage,
  Button,
  CheckboxField,
  SelectField,
  TextAreaField,
  TextField,
  useAction,
} from './fields';

export function TimelineForm({
  entry,
  projects,
}: {
  entry?: AdminTimelineEntry;
  projects: { id: string; title: string }[];
}) {
  const router = useRouter();
  const { run, status, pending } = useAction();
  const es = entry?.translations.es;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? '');
    const payload = {
      type: text('type'),
      organization: text('organization'),
      startDate: text('startDate'),
      endDate: text('endDate'),
      datePrecision: text('datePrecision'),
      credentialUrl: text('credentialUrl'),
      relatedProjectId: text('relatedProjectId'),
      published: data.get('published') === 'on',
      translations: { es: { title: text('title'), description: text('description') } },
    };
    if (entry) {
      run(() => adminRequest(`/timeline/${entry.id}`, { method: 'PATCH', json: payload }), {
        success: 'Entrada guardada. El sitio se actualiza en un minuto como máximo.',
        form,
      });
    } else {
      run(
        async () => {
          await adminRequest('/timeline', { method: 'POST', json: payload });
          router.push('/admin/trayectoria');
        },
        { form },
      );
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <SelectField
        label="Tipo"
        name="type"
        defaultValue={entry?.type ?? 'EXPERIENCE'}
        options={[
          { value: 'EXPERIENCE', label: 'Experiencia' },
          { value: 'EDUCATION', label: 'Educación' },
          { value: 'CERTIFICATION', label: 'Certificación' },
        ]}
      />
      <TextField label="Título" name="title" defaultValue={es?.title} required />
      <TextField
        label="Organización"
        name="organization"
        defaultValue={entry?.organization}
        required
      />
      <TextAreaField
        label="Descripción"
        name="description"
        defaultValue={es?.description ?? ''}
        rows={5}
        hint="Si queda vacía, no se muestra."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Fecha de inicio"
          name="startDate"
          type="date"
          defaultValue={entry?.startDate.slice(0, 10)}
          required
        />
        <TextField
          label="Fecha de fin"
          name="endDate"
          type="date"
          defaultValue={entry?.endDate?.slice(0, 10) ?? ''}
          hint='Vacía: figura como "actualidad", o solo la fecha si es una certificación.'
        />
      </div>
      <SelectField
        label="Mostrar las fechas como"
        name="datePrecision"
        defaultValue={entry?.datePrecision ?? 'MONTH'}
        options={[
          { value: 'MONTH', label: 'Mes y año' },
          { value: 'YEAR', label: 'Solo el año' },
        ]}
      />
      <TextField
        label="Link de la credencial"
        name="credentialUrl"
        type="url"
        defaultValue={entry?.credentialUrl ?? ''}
        hint="Si queda vacío, no se muestra."
      />
      <SelectField
        label="Proyecto relacionado"
        name="relatedProjectId"
        defaultValue={entry?.relatedProjectId ?? ''}
        options={[
          { value: '', label: 'Ninguno' },
          ...projects.map((project) => ({ value: project.id, label: project.title })),
        ]}
      />
      <CheckboxField
        label="Publicada en el sitio"
        name="published"
        defaultChecked={entry?.published ?? true}
      />
      <ActionMessage status={status} />
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? 'Guardando…' : entry ? 'Guardar entrada' : 'Crear entrada'}
      </Button>
    </form>
  );
}

/** Reordena de la más reciente a la más antigua, sin tocar nada más. */
export function SortByDateButton({
  entries,
}: {
  entries: Pick<AdminTimelineEntry, 'id' | 'startDate'>[];
}) {
  const { run, status, pending } = useAction();
  const sort = () => {
    const ids = [...entries]
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .map((entry) => entry.id);
    run(() => adminRequest('/timeline/reorder', { method: 'PUT', json: { ids } }), {
      success: 'Ordenada por fecha.',
    });
  };
  return (
    <div>
      <Button disabled={pending || entries.length === 0} onClick={sort}>
        Ordenar por fecha
      </Button>
      <ActionMessage status={status} />
    </div>
  );
}
