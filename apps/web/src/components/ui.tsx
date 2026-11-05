import Link from 'next/link';
import type { ReactNode } from 'react';

export function Container({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`mx-auto w-full max-w-content px-4 sm:px-6 ${className}`}>{children}</div>;
}

export function Section({
  id,
  label,
  title,
  children,
}: {
  id: string;
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 py-12 sm:py-16">
      <Container>
        <MonoLabel>{label}</MonoLabel>
        <h2 id={`${id}-title`} className="mt-2 text-2xl sm:text-3xl">
          {title}
        </h2>
        <div className="mt-8">{children}</div>
      </Container>
    </section>
  );
}

/** Etiqueta monoespaciada: el único uso de la mono como acento (docs/diseno.md). */
export function MonoLabel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`font-mono text-label tracking-(--text-label--letter-spacing) text-muted uppercase ${className}`}
    >
      {children}
    </p>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <li className="rounded-sm border border-border px-2 py-0.5 font-mono text-label text-muted">
      {children}
    </li>
  );
}

const buttonBase =
  'inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-sm font-medium no-underline transition-colors duration-150 hover:no-underline';

export function ButtonLink({
  href,
  children,
  variant = 'secondary',
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  const style =
    variant === 'primary'
      ? 'bg-accent text-accent-contrast hover:opacity-90'
      : 'border border-border-strong text-text hover:border-accent hover:text-accent';
  const className = `${buttonBase} ${style}`;
  // Los links a /cv son descargas servidas por la API: <a> normal, sin navegación de cliente.
  if (href.startsWith('/') && !href.startsWith('/cv')) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

/** Aviso destacado (por ejemplo, un proyecto personal sin afiliación con una marca). */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p
      className="rounded-md border border-accent/60 bg-surface px-3 py-2 text-sm text-text"
      role="note"
    >
      {children}
    </p>
  );
}
