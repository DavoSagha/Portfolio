'use client';

import type { FormEvent } from 'react';
import { adminRequest } from '@/lib/admin-client';
import type { AdminCategory, AdminSkill } from '@/lib/admin-types';
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

const LEVELS = [
  { value: '', label: 'Sin nivel' },
  { value: 'BASIC', label: 'Básico' },
  { value: 'INTERMEDIATE', label: 'Intermedio' },
  { value: 'SOLID', label: 'Sólido' },
];

function SkillRow({
  skill,
  categories,
  ids,
  index,
}: {
  skill: AdminSkill;
  categories: AdminCategory[];
  ids: string[];
  index: number;
}) {
  const { run, status, pending } = useAction();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    run(
      () =>
        adminRequest(`/skills/${skill.id}`, {
          method: 'PATCH',
          json: {
            name: data.get('name'),
            level: data.get('level'),
            categoryId: data.get('categoryId'),
            published: data.get('published') === 'on',
          },
        }),
      { success: 'Guardada.', form },
    );
  };
  return (
    <li className="rounded-md border border-border p-3">
      <form onSubmit={submit} className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_auto_auto]">
        <TextField label="Nombre" name="name" defaultValue={skill.name} required />
        <SelectField label="Nivel" name="level" defaultValue={skill.level ?? ''} options={LEVELS} />
        <SelectField
          label="Categoría"
          name="categoryId"
          defaultValue={skill.categoryId}
          options={categories.map((c) => ({ value: c.id, label: c.translations.es?.name ?? c.id }))}
        />
        <CheckboxField label="Publicada" name="published" defaultChecked={skill.published} />
        <Button type="submit" disabled={pending} aria-label={`Guardar ${skill.name}`}>
          Guardar
        </Button>
      </form>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <ActionMessage status={status} />
        <div className="ml-auto flex flex-wrap gap-2">
          <MoveButtons reorderPath="/skills/reorder" ids={ids} index={index} name={skill.name} />
          <DeleteButton path={`/skills/${skill.id}`} name={skill.name} />
        </div>
      </div>
    </li>
  );
}

function NewSkillForm({ categoryId }: { categoryId: string }) {
  const { run, status, pending } = useAction();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    run(
      () =>
        adminRequest('/skills', {
          method: 'POST',
          json: {
            categoryId,
            name: data.get('name'),
            level: data.get('level'),
            published: data.get('published') === 'on',
          },
        }),
      { success: 'Skill creada.', form, after: () => form.reset() },
    );
  };
  return (
    <form onSubmit={submit} className="mt-3 grid items-end gap-3 sm:grid-cols-[2fr_1fr_auto_auto]">
      <TextField label="Nueva skill" name="name" required />
      <SelectField label="Nivel" name="level" defaultValue="" options={LEVELS} />
      <CheckboxField label="Publicada" name="published" />
      <Button type="submit" disabled={pending}>
        Agregar
      </Button>
      <div className="sm:col-span-4">
        <ActionMessage status={status} />
      </div>
    </form>
  );
}

function CategorySection({
  category,
  categories,
  skills,
  index,
}: {
  category: AdminCategory;
  categories: AdminCategory[];
  skills: AdminSkill[];
  index: number;
}) {
  const { run, status, pending } = useAction();
  const name = category.translations.es?.name ?? '';
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    run(
      () =>
        adminRequest(`/skill-categories/${category.id}`, {
          method: 'PATCH',
          json: {
            published: data.get('published') === 'on',
            translations: { es: { name: data.get('name') } },
          },
        }),
      { success: 'Categoría guardada.', form },
    );
  };
  const skillIds = skills.map((skill) => skill.id);
  return (
    <section
      aria-label={`Categoría ${name}`}
      className="rounded-md border border-border-strong p-4"
    >
      <form onSubmit={submit} className="grid items-end gap-3 sm:grid-cols-[2fr_auto_auto]">
        <TextField label="Categoría" name="name" defaultValue={name} required />
        <CheckboxField label="Publicada" name="published" defaultChecked={category.published} />
        <Button type="submit" disabled={pending} aria-label={`Guardar categoría ${name}`}>
          Guardar
        </Button>
      </form>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <ActionMessage status={status} />
        <div className="ml-auto flex flex-wrap gap-2">
          <MoveButtons
            reorderPath="/skill-categories/reorder"
            ids={categories.map((c) => c.id)}
            index={index}
            name={`la categoría ${name}`}
          />
          <DeleteButton path={`/skill-categories/${category.id}`} name={`la categoría ${name}`} />
        </div>
      </div>
      <ul className="mt-4 space-y-3">
        {skills.map((skill, skillIndex) => (
          <SkillRow
            key={skill.id}
            skill={skill}
            categories={categories}
            ids={skillIds}
            index={skillIndex}
          />
        ))}
      </ul>
      <NewSkillForm categoryId={category.id} />
    </section>
  );
}

function NewCategoryForm() {
  const { run, status, pending } = useAction();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    run(
      () =>
        adminRequest('/skill-categories', {
          method: 'POST',
          json: { translations: { es: { name: data.get('name') } } },
        }),
      { success: 'Categoría creada.', form, after: () => form.reset() },
    );
  };
  return (
    <form onSubmit={submit} className="grid items-end gap-3 sm:grid-cols-[2fr_auto]">
      <TextField label="Nueva categoría" name="name" required />
      <Button type="submit" disabled={pending}>
        Crear categoría
      </Button>
      <div className="sm:col-span-2">
        <ActionMessage status={status} />
      </div>
    </form>
  );
}

export function SkillsEditor({
  categories,
  skills,
}: {
  categories: AdminCategory[];
  skills: AdminSkill[];
}) {
  return (
    <div className="space-y-6">
      {categories.map((category, index) => (
        <CategorySection
          key={category.id}
          category={category}
          categories={categories}
          skills={skills.filter((skill) => skill.categoryId === category.id)}
          index={index}
        />
      ))}
      <NewCategoryForm />
    </div>
  );
}
