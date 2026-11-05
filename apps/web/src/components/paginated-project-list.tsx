'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useRef, useSyncExternalStore, type ReactNode } from 'react';

export const PAGE_SIZE = 3;
export const PAGE_PARAM = 'pagina';
// Mismo corte que el breakpoint `md` de Tailwind: por debajo es celular.
const MOBILE_QUERY = '(max-width: 767.98px)';

/** "2" → 2. Cualquier valor que no sea una página existente (0, -1, 1.5, abc, 99) → 1. */
export function parsePage(raw: string | null, totalPages: number): number {
  if (raw === null || !/^[1-9]\d*$/.test(raw)) return 1;
  const page = Number(raw);
  return page <= totalPages ? page : 1;
}

function subscribeToViewport(onChange: () => void) {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
const isMobileViewport = () => window.matchMedia(MOBILE_QUERY).matches;

/**
 * Lista de proyectos con paginación solo en celular (D-027).
 * - El servidor renderiza todos los proyectos: los links son rastreables y, si JavaScript
 *   no carga, se ven todos. La paginación solo oculta o muestra elementos en el cliente.
 * - La página vive en la URL (?pagina=2): funcionan el botón Atrás y los links compartidos.
 * - En escritorio se ven todos, y la página de la URL se conserva para volver a celular.
 */
export function PaginatedProjectList({
  items,
  labelledBy,
}: {
  items: { key: string; node: ReactNode }[];
  labelledBy: string;
}) {
  // En el servidor (y sin JS) no hay viewport: se renderiza como escritorio, es decir, todo visible.
  const isMobile = useSyncExternalStore(subscribeToViewport, isMobileViewport, () => false);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const listRef = useRef<HTMLUListElement>(null);

  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const paginated = isMobile && items.length > PAGE_SIZE;
  const page = parsePage(searchParams.get(PAGE_PARAM), totalPages);
  const start = (page - 1) * PAGE_SIZE;

  const goTo = (target: number) => {
    if (target === page || target < 1 || target > totalPages) return;
    const params = new URLSearchParams(searchParams.toString());
    if (target === 1) params.delete(PAGE_PARAM);
    else params.set(PAGE_PARAM, String(target));
    const query = params.toString();
    // pushState nativo: Next sincroniza useSearchParams sin pedir de nuevo la página al servidor.
    window.history.pushState(null, '', query ? `${pathname}?${query}` : pathname);

    const list = listRef.current;
    if (list) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      list.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      // El foco va al inicio de la lista para que teclado y lector de pantalla sigan el cambio.
      list.focus({ preventScroll: true });
    }
  };

  const baseButton =
    'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors duration-150';
  const idleButton = 'border-border-strong text-text hover:border-accent hover:text-accent';
  const disabledButton =
    'disabled:cursor-not-allowed disabled:border-border disabled:text-muted disabled:hover:border-border disabled:hover:text-muted';

  return (
    <>
      <ul
        ref={listRef}
        tabIndex={-1}
        aria-labelledby={labelledBy}
        className="mt-10 grid scroll-mt-24 gap-6 outline-none md:grid-cols-2"
      >
        {items.map((item, index) => (
          <li key={item.key} hidden={paginated && (index < start || index >= start + PAGE_SIZE)}>
            {item.node}
          </li>
        ))}
      </ul>

      {paginated && (
        <nav aria-label="Paginación de proyectos" className="mt-8 flex flex-col items-center gap-3">
          <p className="font-mono text-label text-muted" aria-live="polite">
            Página {page} de {totalPages}
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-2">
            <li>
              <button
                type="button"
                onClick={() => goTo(page - 1)}
                disabled={page === 1}
                className={`${baseButton} ${idleButton} ${disabledButton}`}
              >
                Anterior
              </button>
            </li>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => {
              const current = n === page;
              return (
                <li key={n}>
                  <button
                    type="button"
                    onClick={() => goTo(n)}
                    aria-label={`Página ${n}`}
                    aria-current={current ? 'page' : undefined}
                    className={`${baseButton} ${
                      current ? 'border-accent bg-accent text-accent-contrast' : idleButton
                    }`}
                  >
                    {n}
                  </button>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={() => goTo(page + 1)}
                disabled={page === totalPages}
                className={`${baseButton} ${idleButton} ${disabledButton}`}
              >
                Siguiente
              </button>
            </li>
          </ul>
        </nav>
      )}
    </>
  );
}
