'use client';

import type { FormEvent } from 'react';
import { adminRequest } from '@/lib/admin-client';
import type { AdminLanguage } from '@/lib/admin-types';
import {
  ActionMessage,
  Button,
  CheckboxField,
  DeleteButton,
  MoveButtons,
  SelectField,
  TextField,
  useAction,
} from './fields';

const LEVELS = ['NATIVE', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((value) => ({
  value,
  label: value === 'NATIVE' ? 'Nativo' : value,
}));

function LanguageRow({
  language,
  ids,
  index,
}: {
  language: AdminLanguage;
  ids: string[];
  index: number;
}) {
  const { run, status, pending } = useAction();
  const name = language.translations.es?.name ?? language.code;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    run(
      () =>
        adminRequest(`/languages/${language.id}`, {
          method: 'PATCH',
          json: {
            code: data.get('code'),
            level: data.get('level'),
            published: data.get('published') === 'on',
            translations: { es: { name: data.get('name') } },
          },
        }),
      { success: 'Guardado.', form },
    );
  };
  return (
    <li className="rounded-md border border-border p-3">
      <form onSubmit={submit} className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_auto_auto]">
        <TextField label="Nombre" name="name" defaultValue={name} required />
        <TextField label="Código" name="code" defaultValue={language.code} required />
        <SelectField label="Nivel" name="level" defaultValue={language.level} options={LEVELS} />
        <CheckboxField label="Publicado" name="published" defaultChecked={language.published} />
        <Button type="submit" disabled={pending} aria-label={`Guardar ${name}`}>
          Guardar
        </Button>
      </form>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <ActionMessage status={status} />
        <div className="ml-auto flex flex-wrap gap-2">
          <MoveButtons reorderPath="/languages/reorder" ids={ids} index={index} name={name} />
          <DeleteButton path={`/languages/${language.id}`} name={name} />
        </div>
      </div>
    </li>
  );
}

export function LanguagesEditor({ languages }: { languages: AdminLanguage[] }) {
  const { run, status, pending } = useAction();
  const ids = languages.map((language) => language.id);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    run(
      () =>
        adminRequest('/languages', {
          method: 'POST',
          json: {
            code: data.get('code'),
            level: data.get('level'),
            translations: { es: { name: data.get('name') } },
          },
        }),
      { success: 'Idioma creado.', form, after: () => form.reset() },
    );
  };
  return (
    <div className="space-y-6">
      <ul className="space-y-3">
        {languages.map((language, index) => (
          <LanguageRow key={language.id} language={language} ids={ids} index={index} />
        ))}
      </ul>
      <form onSubmit={submit} className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <TextField label="Nuevo idioma" name="name" required />
        <TextField label="Código" name="code" required hint="Por ejemplo: pt" />
        <SelectField label="Nivel" name="level" defaultValue="B1" options={LEVELS} />
        <Button type="submit" disabled={pending}>
          Agregar
        </Button>
        <div className="sm:col-span-4">
          <ActionMessage status={status} />
        </div>
      </form>
    </div>
  );
}
