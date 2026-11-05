'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore, useTransition } from 'react';
import { logout } from '@/lib/admin-client';
import {
  clearSessionHint,
  hasSessionHint,
  revealAccessLink,
  subscribeToSessionHint,
} from '@/lib/session-hint';

const linkClass =
  'inline-flex min-h-11 items-center text-sm text-muted hover:text-text hover:underline';

/**
 * Acceso discreto al panel (D-032). El servidor renderiza siempre "Acceso": el HTML público no
 * depende de la sesión y funciona sin JavaScript. El estado se resuelve solo en el cliente.
 */
export function FooterAccess() {
  const router = useRouter();
  const pathname = usePathname();
  // En el servidor no hay marca: se renderiza como un visitante.
  const hint = useSyncExternalStore(subscribeToSessionHint, hasSessionHint, () => false);
  // Las páginas del panel ya tienen su navegación y solo se ven con sesión: acá no hay nada.
  const inPanel = pathname.startsWith('/admin') && pathname !== '/admin/login';
  const [active, setActive] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!hint || inPanel) return;
    const controller = new AbortController();
    fetch('/api/v1/auth/me', { signal: controller.signal })
      .then((res) => {
        if (res.ok) {
          setActive(true);
        } else if (res.status === 401) {
          // Sesión vencida o marca sin sesión: no se vuelve a consultar en las próximas visitas.
          clearSessionHint();
        } else {
          revealAccessLink();
        }
      })
      .catch((err: unknown) => {
        // Sin conexión no se sabe si venció: se muestra "Acceso" y se reintenta en otra visita.
        if (!controller.signal.aborted) revealAccessLink();
        if (!controller.signal.aborted) console.error(err);
      });
    return () => {
      controller.abort();
      setActive(false);
    };
  }, [hint, inPanel]);

  const signOut = () => {
    setFailed(false);
    startTransition(async () => {
      try {
        await logout();
        router.refresh();
      } catch {
        setFailed(true);
      }
    });
  };

  if (inPanel) return null;

  if (hint && active) {
    return (
      <nav aria-label="Administración" className="flex flex-wrap items-center gap-x-4">
        {/* prefetch: si no, Next pediría /admin, y el servidor consultaría la sesión. */}
        <Link href="/admin" prefetch={false} className={linkClass}>
          Panel
        </Link>
        <button type="button" disabled={pending} onClick={signOut} className={linkClass}>
          Cerrar sesión
        </button>
        {failed && (
          <span role="alert" className="text-sm text-danger">
            No se pudo cerrar la sesión. Probá de nuevo.
          </span>
        )}
      </nav>
    );
  }

  return (
    <nav aria-label="Administración" className="flex flex-wrap items-center gap-x-4">
      {/* nofollow: un buscador no tiene nada que seguir acá. */}
      <Link href="/admin" prefetch={false} rel="nofollow" className={`footer-access ${linkClass}`}>
        Acceso
      </Link>
    </nav>
  );
}
