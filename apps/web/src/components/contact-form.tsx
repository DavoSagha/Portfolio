'use client';

import { useId, useRef, useState, useTransition, type ComponentProps, type FormEvent } from 'react';

type FieldName = 'name' | 'email' | 'message';
type FieldErrors = Partial<Record<FieldName, string>>;

const inputClass =
  'mt-1 block min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-text aria-[invalid=true]:border-danger';

function Field({
  label,
  name,
  error,
  multiline,
  ...props
}: {
  label: string;
  name: FieldName;
  error?: string | undefined;
  multiline?: boolean;
} & ComponentProps<'input'>) {
  const errorId = useId();
  const shared = {
    name,
    required: true,
    className: inputClass,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
  };
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {multiline ? <textarea rows={6} {...shared} /> : <input {...shared} {...props} />}
      {error && (
        <span id={errorId} className="mt-1 block text-sm text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

/** Solo envía a la API y muestra sus errores: la validación vive en un solo lugar. */
export function ContactForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setErrors({});
    setStatus(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/v1/public/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.fromEntries(data)),
        });
        if (res.ok) {
          form.reset();
          setStatus({ kind: 'success', text: 'Mensaje enviado. Gracias por escribirme.' });
        } else if (res.status === 400) {
          const body = (await res.json()) as {
            error: { details?: { path: string; message: string }[] };
          };
          const fieldErrors = Object.fromEntries(
            (body.error.details ?? []).map((d) => [d.path, d.message]),
          ) as FieldErrors;
          setErrors(fieldErrors);
          const first = (['name', 'email', 'message'] as const).find((f) => fieldErrors[f]);
          if (first) (form.elements.namedItem(first) as HTMLElement | null)?.focus();
        } else if (res.status === 429) {
          setStatus({
            kind: 'error',
            text: 'Enviaste varios mensajes seguidos. Probá de nuevo más tarde.',
          });
        } else {
          setStatus({ kind: 'error', text: 'No se pudo enviar el mensaje. Probá de nuevo.' });
        }
      } catch {
        setStatus({ kind: 'error', text: 'No se pudo enviar el mensaje. Revisá tu conexión.' });
      }
    });
  };

  return (
    <>
      <noscript>
        {/* Sin JavaScript el formulario no puede enviarse: quedan los demás medios de contacto. */}
        <style>{'#formulario-contacto{display:none}'}</style>
        <p className="text-muted">
          Para usar el formulario hace falta JavaScript. También podés escribirme por los medios de
          esta sección.
        </p>
      </noscript>
      <form
        id="formulario-contacto"
        ref={formRef}
        onSubmit={submit}
        noValidate
        className="max-w-prose space-y-4"
      >
        <Field label="Nombre" name="name" autoComplete="name" maxLength={100} error={errors.name} />
        <Field label="Email" name="email" type="email" autoComplete="email" error={errors.email} />
        <Field label="Mensaje" name="message" multiline error={errors.message} />

        {/* Honeypot: una persona no lo ve ni lo alcanza con el teclado. */}
        <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
          <label>
            No completar este campo
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <div aria-live="polite">
          {status && (
            <p
              role={status.kind === 'error' ? 'alert' : 'status'}
              className={`text-sm ${status.kind === 'error' ? 'text-danger' : 'text-secondary'}`}
            >
              {status.text}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Enviando…' : 'Enviar mensaje'}
        </button>
      </form>
    </>
  );
}
