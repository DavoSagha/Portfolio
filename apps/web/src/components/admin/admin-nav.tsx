'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useTransition } from 'react';
import { logout as closeSession } from '@/lib/admin-client';
import { setSessionHint } from '@/lib/session-hint';
import { Button } from './fields';

const LINKS = [
  { href: '/admin', label: 'Inicio' },
  { href: '/admin/perfil', label: 'Perfil' },
  { href: '/admin/proyectos', label: 'Proyectos' },
  { href: '/admin/trayectoria', label: 'Trayectoria' },
  { href: '/admin/skills', label: 'Skills' },
  { href: '/admin/idiomas', label: 'Idiomas' },
  { href: '/admin/cv', label: 'CV' },
];

/** Lateral en escritorio y una lista simple en celular (docs/diseno.md). */
export function AdminNav({ username }: { username: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Esta página solo se renderiza con sesión: cubre también las sesiones sin marca.
  useEffect(() => setSessionHint(), []);

  const logout = () =>
    startTransition(async () => {
      await closeSession();
      router.replace('/admin/login');
      router.refresh();
    });

  return (
    <nav aria-label="Panel" className="md:w-48 md:shrink-0">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 md:flex-col">
        {LINKS.map(({ href, label }) => {
          const current = href === '/admin' ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center text-sm ${
                  current ? 'font-semibold text-text' : 'text-muted'
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 border-t border-border pt-4">
        <p className="text-sm text-muted">{username}</p>
        <Button className="mt-2" disabled={pending} onClick={logout}>
          Cerrar sesión
        </Button>
      </div>
    </nav>
  );
}
