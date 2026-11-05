'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, useTransition, type ComponentProps, type ReactNode } from 'react';
import { ApiError, adminRequest, type ApiErrorDetail } from '@/lib/admin-client';

const inputClass =
  'mt-1 block min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-text aria-[invalid=true]:border-danger';

function Label({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="text-sm font-medium">
      {children}
      {required && <span className="text-danger"> (obligatorio)</span>}
    </span>
  );
}

function Hint({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span id={id} className="mt-1 block text-sm text-muted">
      {children}
    </span>
  );
}

type TextFieldProps = ComponentProps<'input'> & { label: string; hint?: ReactNode };

export function TextField({ label, hint, required, ...props }: TextFieldProps) {
  const hintId = useId();
  return (
    <label className="block">
      <Label required={required}>{label}</Label>
      <input
        className={inputClass}
        required={required}
        aria-describedby={hint ? hintId : undefined}
        {...props}
      />
      {hint && <Hint id={hintId}>{hint}</Hint>}
    </label>
  );
}

type TextAreaProps = ComponentProps<'textarea'> & { label: string; hint?: ReactNode };

export function TextAreaField({ label, hint, required, rows = 4, ...props }: TextAreaProps) {
  const hintId = useId();
  return (
    <label className="block">
      <Label required={required}>{label}</Label>
      <textarea
        className={inputClass}
        rows={rows}
        required={required}
        aria-describedby={hint ? hintId : undefined}
        {...props}
      />
      {hint && <Hint id={hintId}>{hint}</Hint>}
    </label>
  );
}

type SelectProps = ComponentProps<'select'> & {
  label: string;
  options: { value: string; label: string }[];
};

export function SelectField({ label, options, required, ...props }: SelectProps) {
  return (
    <label className="block">
      <Label required={required}>{label}</Label>
      <select className={inputClass} required={required} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CheckboxField({
  label,
  hint,
  ...props
}: ComponentProps<'input'> & { label: string; hint?: ReactNode }) {
  const hintId = useId();
  return (
    <label className="flex min-h-11 items-center gap-2">
      <input
        type="checkbox"
        className="size-5 accent-accent"
        aria-describedby={hint ? hintId : undefined}
        {...props}
      />
      <span className="text-sm">
        {label}
        {hint && <Hint id={hintId}>{hint}</Hint>}
      </span>
    </label>
  );
}

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const style = {
    primary: 'bg-accent text-accent-contrast hover:opacity-90',
    secondary: 'border border-border-strong text-text hover:border-accent hover:text-accent',
    danger: 'border border-danger text-danger hover:opacity-80',
  }[variant];
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center rounded-md px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${style} ${className}`}
      {...props}
    />
  );
}

export type ActionStatus =
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string; details: string[] }
  | null;

/** Nombre visible de un campo a partir de la ruta del error ("translations.es.title" → "Título"). */
function fieldLabel(form: HTMLFormElement | null | undefined, detail: ApiErrorDetail) {
  const name = detail.path
    .split('.')
    .filter((part) => !/^\d+$/.test(part))
    .at(-1);
  const field = name ? form?.elements.namedItem(name) : null;
  if (field instanceof HTMLElement && 'labels' in field) {
    const labels = field.labels as NodeListOf<HTMLLabelElement> | null;
    const text = labels?.[0]?.querySelector('span')?.firstChild?.textContent;
    field.setAttribute('aria-invalid', 'true');
    if (text) return text;
  }
  return name ?? 'Formulario';
}

/**
 * Ejecuta una operación contra la API y muestra el resultado. Los formularios no tienen reglas:
 * los errores vienen de la API y se ubican junto al nombre de cada campo.
 */
export function useAction() {
  const router = useRouter();
  const [status, setStatus] = useState<ActionStatus>(null);
  const [pending, startTransition] = useTransition();

  const run = (
    action: () => Promise<unknown>,
    { success, form, after }: { success?: string; form?: HTMLFormElement; after?: () => void } = {},
  ) => {
    setStatus(null);
    form?.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    startTransition(async () => {
      try {
        await action();
        if (success) setStatus({ kind: 'success', message: success });
        after?.();
        router.refresh();
      } catch (err) {
        const apiError = err instanceof ApiError ? err : null;
        setStatus({
          kind: 'error',
          message: apiError?.message ?? 'No se pudo completar la operación',
          details: apiError?.details.map((d) => `${fieldLabel(form, d)}: ${d.message}`) ?? [],
        });
      }
    });
  };
  return { run, status, pending };
}

export function ActionMessage({ status }: { status: ActionStatus }) {
  return (
    <div aria-live="polite">
      {status?.kind === 'success' && (
        <p role="status" className="text-sm text-secondary">
          {status.message}
        </p>
      )}
      {status?.kind === 'error' && (
        <div role="alert" className="text-sm text-danger">
          <p>{status.message}</p>
          {status.details.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {status.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Subir o bajar un elemento: botones y no arrastre, para que funcione con teclado y en celular. */
export function MoveButtons({
  reorderPath,
  ids,
  index,
  name,
}: {
  reorderPath: string;
  ids: string[];
  index: number;
  name: string;
}) {
  const { run, pending, status } = useAction();
  const move = (delta: number) => {
    const next = [...ids];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item!);
    run(() => adminRequest(reorderPath, { method: 'PUT', json: { ids: next } }));
  };
  return (
    <div className="flex items-center gap-2">
      <Button
        aria-label={`Subir ${name}`}
        disabled={pending || index === 0}
        onClick={() => move(-1)}
      >
        ↑
      </Button>
      <Button
        aria-label={`Bajar ${name}`}
        disabled={pending || index === ids.length - 1}
        onClick={() => move(1)}
      >
        ↓
      </Button>
      <ActionMessage status={status?.kind === 'error' ? status : null} />
    </div>
  );
}

export function DeleteButton({
  path,
  name,
  after,
  label = 'Borrar',
}: {
  path: string;
  name: string;
  after?: () => void;
  label?: string;
}) {
  const { run, pending, status } = useAction();
  return (
    <div>
      <Button
        variant="danger"
        disabled={pending}
        aria-label={`${label} ${name}`}
        onClick={() => {
          if (window.confirm(`¿${label} ${name}? No se puede deshacer.`)) {
            run(() => adminRequest(path, { method: 'DELETE' }), { after });
          }
        }}
      >
        {label}
      </Button>
      <ActionMessage status={status?.kind === 'error' ? status : null} />
    </div>
  );
}
