'use client';

import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { adminRequest } from '@/lib/admin-client';
import type { AdminProject } from '@/lib/admin-types';
import {
  ActionMessage,
  Button,
  CheckboxField,
  SelectField,
  TextAreaField,
  TextField,
  useAction,
} from './fields';

const SECTIONS = [
  ['context', 'Contexto'],
  ['problem', 'Problema'],
  ['solution', 'Solución'],
  ['architecture', 'Arquitectura'],
  ['decisions', 'Decisiones'],
  ['challenges', 'Dificultades'],
  ['learnings', 'Aprendizajes'],
  ['limitations', 'Limitaciones'],
] as const;

export interface SkillOption {
  id: string;
  name: string;
}

export function ProjectForm({
  project,
  skills,
}: {
  project?: AdminProject;
  skills: SkillOption[];
}) {
  const router = useRouter();
  const { run, status, pending } = useAction();
  const es = project?.translations.es;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? '');
    const payload = {
      slug: text('slug'),
      status: text('status'),
      featured: data.get('featured') === 'on',
      inProgress: data.get('inProgress') === 'on',
      team: text('team'),
      origin: text('origin'),
      startDate: text('startDate'),
      endDate: text('endDate'),
      stack: text('stack')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      demoUrl: text('demoUrl'),
      repoUrl: text('repoUrl'),
      skillIds: data.getAll('skillIds'),
      translations: {
        es: {
          title: text('title'),
          summary: text('summary'),
          role: text('role'),
          disclaimer: text('disclaimer'),
          demoNote: text('demoNote'),
          ...Object.fromEntries(SECTIONS.map(([name]) => [name, text(name)])),
        },
      },
    };
    if (project) {
      run(() => adminRequest(`/projects/${project.id}`, { method: 'PATCH', json: payload }), {
        success: 'Proyecto guardado. El sitio se actualiza en un minuto como máximo.',
        form,
      });
    } else {
      run(
        async () => {
          const created = await adminRequest<AdminProject>('/projects', {
            method: 'POST',
            json: payload,
          });
          router.push(`/admin/proyectos/${created.id}`);
        },
        { form },
      );
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Datos principales</legend>
        <TextField label="Título" name="title" defaultValue={es?.title} required />
        <TextField
          label="Identificador en la URL"
          name="slug"
          defaultValue={project?.slug}
          required
          hint="Minúsculas, números y guiones: /proyectos/mi-proyecto. Si lo cambiás, el link anterior deja de funcionar."
        />
        <TextAreaField
          label="Resumen"
          name="summary"
          defaultValue={es?.summary}
          rows={2}
          required
        />
        <TextAreaField
          label="Mi aporte"
          name="role"
          defaultValue={es?.role}
          hint="Si queda vacío, no se muestra."
        />
        <TextAreaField
          label="Aviso destacado"
          name="disclaimer"
          defaultValue={es?.disclaimer ?? ''}
          rows={2}
          hint="Por ejemplo, un proyecto sin afiliación con la marca que nombra. Si queda vacío, no se muestra."
        />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Publicación</legend>
        <SelectField
          label="Estado"
          name="status"
          defaultValue={project?.status ?? 'DRAFT'}
          options={[
            { value: 'DRAFT', label: 'Borrador (no se ve en el sitio)' },
            { value: 'PUBLISHED', label: 'Publicado' },
          ]}
        />
        <CheckboxField
          label="Destacado en el inicio"
          name="featured"
          defaultChecked={project?.featured}
        />
        <CheckboxField
          label='Mostrar la etiqueta "En desarrollo"'
          name="inProgress"
          defaultChecked={project?.inProgress}
        />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Links</legend>
        <TextField
          label="Link de la demo"
          name="demoUrl"
          type="url"
          defaultValue={project?.demoUrl ?? ''}
          hint="Si queda vacío, no se muestra."
        />
        <TextField
          label="Aviso de la demo"
          name="demoNote"
          defaultValue={es?.demoNote ?? ''}
          hint="Opcional. Por ejemplo: puede tardar en cargar porque está en un hosting gratuito. Se muestra junto al link, y solo si hay demo."
        />
        <TextField
          label="Link del repositorio"
          name="repoUrl"
          type="url"
          defaultValue={project?.repoUrl ?? ''}
          hint="Si queda vacío, no se muestra."
        />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Clasificación</legend>
        <SelectField
          label="Equipo"
          name="team"
          defaultValue={project?.team ?? ''}
          options={[
            { value: '', label: 'Sin indicar' },
            { value: 'INDIVIDUAL', label: 'Individual' },
            { value: 'GROUP', label: 'Grupal' },
          ]}
        />
        <SelectField
          label="Origen"
          name="origin"
          defaultValue={project?.origin ?? ''}
          options={[
            { value: '', label: 'Sin indicar' },
            { value: 'ACADEMIC', label: 'Académico' },
            { value: 'PERSONAL', label: 'Personal' },
            { value: 'PROFESSIONAL', label: 'Profesional' },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Fecha de inicio"
            name="startDate"
            type="date"
            defaultValue={project?.startDate?.slice(0, 10) ?? ''}
          />
          <TextField
            label="Fecha de fin"
            name="endDate"
            type="date"
            defaultValue={project?.endDate?.slice(0, 10) ?? ''}
          />
        </div>
        <TextAreaField
          label="Stack"
          name="stack"
          defaultValue={project?.stack.join('\n')}
          hint="Una tecnología por línea, en el orden en que se muestran."
        />
        {skills.length > 0 && (
          <fieldset>
            <legend className="text-sm font-medium">Skills usadas en este proyecto</legend>
            <p className="text-sm text-muted">
              Aparecen como &quot;Usada en…&quot; en la sección de skills.
            </p>
            <div className="mt-2 grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
              {skills.map((skill) => (
                <CheckboxField
                  key={skill.id}
                  label={skill.name}
                  name="skillIds"
                  value={skill.id}
                  defaultChecked={project?.skillIds.includes(skill.id)}
                />
              ))}
            </div>
          </fieldset>
        )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Detalle</legend>
        <p className="text-sm text-muted">Una sección vacía no se muestra.</p>
        {SECTIONS.map(([name, label]) => (
          <TextAreaField key={name} label={label} name={name} defaultValue={es?.[name] ?? ''} />
        ))}
      </fieldset>

      <ActionMessage status={status} />
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? 'Guardando…' : project ? 'Guardar proyecto' : 'Crear proyecto'}
      </Button>
    </form>
  );
}
