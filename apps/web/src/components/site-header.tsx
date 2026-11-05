import Link from 'next/link';
import type { Home } from '@/lib/types';
import { ThemeToggle } from './theme-toggle';
import { Container } from './ui';

const NAV: { key: keyof Home['sections']; href: string; label: string }[] = [
  { key: 'projects', href: '/#proyectos', label: 'Proyectos' },
  { key: 'timeline', href: '/#trayectoria', label: 'Trayectoria' },
  { key: 'skills', href: '/#skills', label: 'Skills' },
  { key: 'languages', href: '/#idiomas', label: 'Idiomas' },
  { key: 'contact', href: '/#contacto', label: 'Contacto' },
];

export function SiteHeader({
  name,
  sections,
}: {
  name: string;
  sections: Home['sections'] | null;
}) {
  const items = NAV.filter((item) => sections?.[item.key]);
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur">
      <Container className="flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2">
        <Link
          href="/"
          className="font-semibold text-text no-underline hover:text-accent hover:no-underline"
        >
          {name}
        </Link>
        <div className="flex items-center gap-4">
          {items.length > 0 && (
            <nav aria-label="Secciones">
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {items.map((item) => (
                  <li key={item.key}>
                    <a href={item.href} className="text-muted hover:text-accent">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <ThemeToggle />
        </div>
      </Container>
    </header>
  );
}
