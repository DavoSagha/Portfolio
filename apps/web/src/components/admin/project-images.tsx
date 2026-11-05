'use client';

import Image from 'next/image';
import type { FormEvent } from 'react';
import { adminRequest } from '@/lib/admin-client';
import type { AdminProject } from '@/lib/admin-types';
import { ActionMessage, Button, DeleteButton, MoveButtons, TextField, useAction } from './fields';

export function ProjectImages({ project }: { project: AdminProject }) {
  const add = useAction();
  const cover = useAction();
  const ids = project.images.map((image) => image.id);

  const addImage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    add.run(() => adminRequest(`/projects/${project.id}/images`, { method: 'POST', form: data }), {
      success: 'Imagen agregada.',
      form,
      after: () => form.reset(),
    });
  };

  const setCover = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    cover.run(() => adminRequest(`/projects/${project.id}/cover`, { method: 'POST', form: data }), {
      success: 'Portada actualizada.',
      form,
      after: () => form.reset(),
    });
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="portada-title" className="space-y-4">
        <h2 id="portada-title" className="text-lg">
          Portada
        </h2>
        {project.coverUrl && (
          <Image
            src={project.coverUrl}
            alt="Portada actual"
            width={320}
            height={200}
            unoptimized
            className="h-auto w-64 rounded-md border border-border"
          />
        )}
        <form onSubmit={setCover} className="space-y-4">
          <TextField
            label="Archivo de portada"
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            hint="JPG, PNG o WebP, hasta 5 MB. Se guarda sin metadatos."
          />
          <ActionMessage status={cover.status} />
          <Button type="submit" disabled={cover.pending}>
            Subir portada
          </Button>
        </form>
        {project.coverUrl && (
          <DeleteButton path={`/projects/${project.id}/cover`} name="la portada" label="Quitar" />
        )}
      </section>

      <section aria-labelledby="imagenes-title" className="space-y-4">
        <h2 id="imagenes-title" className="text-lg">
          Imágenes
        </h2>
        {project.images.length > 0 && (
          <ul className="space-y-4">
            {project.images.map((image, index) => {
              const alt = image.translations.es?.alt ?? '';
              return (
                <li
                  key={image.id}
                  className="flex flex-wrap items-center gap-4 rounded-md border border-border p-3"
                >
                  <Image
                    src={image.url}
                    alt={alt}
                    width={160}
                    height={100}
                    unoptimized
                    className="h-auto w-40 rounded-sm"
                  />
                  <p className="min-w-40 flex-1 text-sm">{alt}</p>
                  <MoveButtons
                    reorderPath={`/projects/${project.id}/images/reorder`}
                    ids={ids}
                    index={index}
                    name={`la imagen ${alt}`}
                  />
                  <DeleteButton
                    path={`/projects/${project.id}/images/${image.id}`}
                    name={`la imagen ${alt}`}
                  />
                </li>
              );
            })}
          </ul>
        )}
        <form onSubmit={addImage} className="space-y-4">
          <TextField
            label="Archivo de imagen"
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            hint="JPG, PNG o WebP, hasta 5 MB. Se guarda sin metadatos."
          />
          <TextField
            label="Texto alternativo"
            name="alt"
            required
            hint="Describe la imagen para quien no puede verla."
          />
          <ActionMessage status={add.status} />
          <Button type="submit" disabled={add.pending}>
            Agregar imagen
          </Button>
        </form>
      </section>
    </div>
  );
}
