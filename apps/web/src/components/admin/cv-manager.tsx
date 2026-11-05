'use client';

import type { FormEvent } from 'react';
import { adminRequest } from '@/lib/admin-client';
import type { AdminCv } from '@/lib/admin-types';
import { ActionMessage, Button, CheckboxField, DeleteButton, TextField, useAction } from './fields';

const PROFILE_LABEL: Record<string, string> = {
  backend: 'Backend',
  mainframe: 'Mainframe',
  soporte: 'Soporte',
};

const dateFormat = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: 'UTC' });

function ProfileCard({
  profile,
  isPrimary,
}: {
  profile: AdminCv['profiles'][number];
  isPrimary: boolean;
}) {
  const upload = useAction();
  const actions = useAction();
  const label = PROFILE_LABEL[profile.profile] ?? profile.profile;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = new FormData();
    body.set('profile', profile.profile);
    body.set('label', String(data.get('label')));
    body.set('makeCurrent', String(data.get('makeCurrent') === 'on'));
    body.set('file', data.get('file') as File);
    upload.run(() => adminRequest('/cv', { method: 'POST', form: body }), {
      success: 'CV subido.',
      form,
      after: () => form.reset(),
    });
  };

  return (
    <section
      aria-label={`CV ${label}`}
      className="space-y-4 rounded-md border border-border-strong p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg">
          {label}
          {isPrimary && <span className="ml-2 text-sm font-normal text-secondary">Principal</span>}
        </h2>
        {!isPrimary && (
          <Button
            disabled={actions.pending || !profile.currentVersionId}
            aria-label={`Hacer principal el perfil ${label}`}
            onClick={() =>
              actions.run(() =>
                adminRequest('/cv/primary', {
                  method: 'PUT',
                  json: { profile: profile.profile },
                }),
              )
            }
          >
            Hacer principal
          </Button>
        )}
      </div>
      <p className="text-sm text-muted">
        Se descarga desde <code>/cv/{profile.profile}</code>.
      </p>
      <ActionMessage status={actions.status} />

      {profile.versions.length === 0 ? (
        <p className="text-sm text-muted">Todavía no hay versiones.</p>
      ) : (
        <ul className="space-y-2">
          {profile.versions.map((version) => {
            const current = version.id === profile.currentVersionId;
            return (
              <li
                key={version.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3"
              >
                <div className="min-w-48 flex-1">
                  <p className="text-sm font-medium">
                    {version.label}
                    {current && <span className="ml-2 font-normal text-secondary">Vigente</span>}
                  </p>
                  <p className="font-mono text-label text-muted">
                    {dateFormat.format(new Date(version.uploadedAt))} ·{' '}
                    {Math.round(version.size / 1024)} KB
                  </p>
                </div>
                <a
                  href={`/api/v1/admin/cv/versions/${version.id}/file`}
                  target="_blank"
                  rel="noopener"
                  className="text-sm"
                >
                  Ver<span className="sr-only"> {version.label} (abre en otra pestaña)</span>
                </a>
                {!current && (
                  <>
                    <Button
                      disabled={actions.pending}
                      aria-label={`Hacer vigente ${version.label}`}
                      onClick={() =>
                        actions.run(() =>
                          adminRequest(`/cv/profiles/${profile.profile}/current`, {
                            method: 'PUT',
                            json: { versionId: version.id },
                          }),
                        )
                      }
                    >
                      Hacer vigente
                    </Button>
                    <DeleteButton path={`/cv/versions/${version.id}`} name={version.label} />
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={submit} className="space-y-3">
        <TextField
          label="Archivo PDF"
          name="file"
          type="file"
          accept="application/pdf"
          required
          hint="Hasta 5 MB."
        />
        <TextField
          label="Etiqueta"
          name="label"
          required
          hint="Para reconocerla en el historial. Por ejemplo: Noviembre 2026."
        />
        <CheckboxField label="Hacerla vigente al subirla" name="makeCurrent" defaultChecked />
        <ActionMessage status={upload.status} />
        <Button type="submit" disabled={upload.pending}>
          {upload.pending ? 'Subiendo…' : `Subir CV ${label}`}
        </Button>
      </form>
    </section>
  );
}

export function CvManager({ cv }: { cv: AdminCv }) {
  return (
    <div className="space-y-6">
      {cv.profiles.map((profile) => (
        <ProfileCard
          key={profile.profile}
          profile={profile}
          isPrimary={profile.profile === cv.primaryProfile}
        />
      ))}
    </div>
  );
}
