'use client';

import Image from 'next/image';
import type { FormEvent } from 'react';
import { adminRequest } from '@/lib/admin-client';
import type { AdminProfile } from '@/lib/admin-types';
import {
  ActionMessage,
  Button,
  CheckboxField,
  DeleteButton,
  TextAreaField,
  TextField,
  useAction,
} from './fields';

export function ProfileForm({ profile }: { profile: AdminProfile }) {
  const { run, status, pending } = useAction();
  const es = profile.translations.es;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? '');
    run(
      () =>
        adminRequest('/profile', {
          method: 'PUT',
          json: {
            fullName: text('fullName'),
            location: text('location'),
            linkedinUrl: text('linkedinUrl'),
            githubUrl: text('githubUrl'),
            publicEmail: text('publicEmail'),
            showEmail: data.get('showEmail') === 'on',
            translations: {
              es: {
                headline: text('headline'),
                valueProp: text('valueProp'),
                summary: text('summary'),
                availability: text('availability'),
              },
            },
          },
        }),
      { success: 'Perfil guardado. El sitio se actualiza en un minuto como máximo.', form },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <TextField label="Nombre" name="fullName" defaultValue={profile.fullName} required />
      <TextField label="Titular" name="headline" defaultValue={es?.headline} required />
      <TextAreaField
        label="Frase de valor"
        name="valueProp"
        defaultValue={es?.valueProp}
        rows={2}
      />
      <TextAreaField label="Resumen" name="summary" defaultValue={es?.summary} rows={5} />
      <TextField label="Ubicación" name="location" defaultValue={profile.location} required />
      <TextField label="Disponibilidad" name="availability" defaultValue={es?.availability} />
      <TextField
        label="LinkedIn"
        name="linkedinUrl"
        type="url"
        defaultValue={profile.linkedinUrl ?? ''}
        hint="Si queda vacío, no se muestra."
      />
      <TextField
        label="GitHub"
        name="githubUrl"
        type="url"
        defaultValue={profile.githubUrl ?? ''}
        hint="Si queda vacío, no se muestra."
      />
      <TextField
        label="Email público"
        name="publicEmail"
        type="email"
        defaultValue={profile.publicEmail ?? ''}
      />
      <CheckboxField
        label="Mostrar el email en el sitio"
        name="showEmail"
        defaultChecked={profile.showEmail}
      />
      <ActionMessage status={status} />
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar perfil'}
      </Button>
    </form>
  );
}

export function PhotoForm({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  const { run, status, pending } = useAction();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    run(() => adminRequest('/profile/photo', { method: 'POST', form: data }), {
      success: 'Foto actualizada. Se guardó sin metadatos.',
      form,
      after: () => form.reset(),
    });
  };

  return (
    <div className="space-y-4">
      {photoUrl && (
        <Image
          src={photoUrl}
          alt={`Foto actual de ${name}`}
          width={160}
          height={160}
          unoptimized
          className="size-40 rounded-md border border-border object-cover"
        />
      )}
      <form onSubmit={submit} className="space-y-4">
        <TextField
          label="Foto"
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          hint="JPG, PNG o WebP, hasta 5 MB. Reemplaza la anterior."
        />
        <ActionMessage status={status} />
        <Button type="submit" disabled={pending}>
          {pending ? 'Subiendo…' : 'Subir foto'}
        </Button>
      </form>
      {photoUrl && <DeleteButton path="/profile/photo" name="la foto" label="Quitar" />}
    </div>
  );
}
