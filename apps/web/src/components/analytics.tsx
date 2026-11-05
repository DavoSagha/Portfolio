'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

const REF_KEY = 'portfolio-ref';
const REF_PATTERN = /^[a-z0-9_-]{1,50}$/;

const isPrivate = (path: string) => /^\/(admin|api)(\/|$)/.test(path);

/**
 * Origen de la visita (`?ref=`). Dura lo que la pestaña, para atribuir también las páginas
 * siguientes y la descarga del CV. No es una cookie: nunca viaja sola al servidor (D-034).
 */
function currentRef() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('ref')?.toLowerCase();
    if (fromUrl && REF_PATTERN.test(fromUrl)) window.sessionStorage.setItem(REF_KEY, fromUrl);
    return window.sessionStorage.getItem(REF_KEY);
  } catch {
    return null;
  }
}

function sendEvent(event: {
  type: 'PAGE_VIEW' | 'PROJECT_CLICK';
  path: string;
  targetId?: string;
}) {
  const body = JSON.stringify({ ...event, ref: currentRef() });
  // sendBeacon sobrevive a la navegación que dispara un clic. Una métrica nunca molesta: si
  // falla, se pierde.
  const sent = navigator.sendBeacon?.(
    '/api/v1/public/events',
    new Blob([body], { type: 'application/json' }),
  );
  if (!sent) {
    void fetch('/api/v1/public/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }
}

/** Métricas propias, sin cookies ni terceros (D-016). La API descarta las visitas del admin. */
export function Analytics() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (isPrivate(pathname) || lastPath.current === pathname) return;
    lastPath.current = pathname;
    sendEvent({ type: 'PAGE_VIEW', path: pathname });
  }, [pathname]);

  useEffect(() => {
    // Un solo listener: las tarjetas de proyecto siguen siendo componentes de servidor.
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a');
      if (!link || isPrivate(window.location.pathname)) return;
      const slug = link.dataset.projectClick;
      if (slug) {
        sendEvent({ type: 'PROJECT_CLICK', path: window.location.pathname, targetId: slug });
      }
      // La descarga la registra el servidor: se le pasa el origen en el link.
      const ref = currentRef();
      if (ref && /^\/cv(\/|$)/.test(link.pathname) && !link.search) {
        link.search = `?ref=${ref}`;
      }
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  return null;
}
