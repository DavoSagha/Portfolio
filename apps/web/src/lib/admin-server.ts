import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

async function forward(path: string) {
  const cookie = (await cookies()).toString();
  // Sin caché: los datos del panel son privados y tienen que estar siempre al día.
  return fetch(`${API_URL}/api/v1${path}`, { headers: { cookie }, cache: 'no-store' });
}

/**
 * Este chequeo solo decide a dónde redirigir: la seguridad real está en la API, que verifica
 * sesión y CSRF en cada endpoint privado (D-006).
 */
export async function currentAdmin(): Promise<{ username: string } | null> {
  const res = await forward('/auth/me');
  return res.ok ? ((await res.json()) as { username: string }) : null;
}

/** Lee un recurso del panel. Null si no existe; sin sesión, redirige al login. */
export async function adminGet<T>(path: string): Promise<T | null> {
  const res = await forward(`/admin${path}`);
  if (res.status === 401) redirect('/admin/login');
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`API /admin${path} respondió ${res.status}`);
  return (await res.json()) as T;
}
