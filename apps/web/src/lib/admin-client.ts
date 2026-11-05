/** Cliente del panel en el navegador. Mismo origen: la cookie de sesión viaja sola. */

export interface ApiErrorDetail {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
    readonly details: ApiErrorDetail[] = [],
  ) {
    super(message);
  }
}

let csrfToken: string | null = null;

async function loadCsrfToken() {
  const res = await fetch('/api/v1/auth/me');
  if (!res.ok) return null;
  return ((await res.json()) as { csrfToken: string }).csrfToken;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Cuerpo JSON. */
  json?: unknown;
  /** Cuerpo multipart, para subir archivos. */
  form?: FormData;
}

async function send(url: string, { method = 'GET', json, form }: RequestOptions) {
  return fetch(url, {
    method,
    headers: {
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
    body: json !== undefined ? JSON.stringify(json) : form,
  });
}

async function toApiError(res: Response) {
  const body = (await res.json().catch(() => null)) as {
    error?: { code?: string; message?: string; details?: ApiErrorDetail[] };
  } | null;
  return new ApiError(
    body?.error?.message ?? 'No se pudo completar la operación',
    res.status,
    body?.error?.code ?? null,
    body?.error?.details,
  );
}

export async function request<T = unknown>(url: string, options: RequestOptions = {}): Promise<T> {
  if (options.method && options.method !== 'GET' && !csrfToken) csrfToken = await loadCsrfToken();

  let res = await send(url, options);
  // El token cambia si la sesión cambió (por ejemplo, otro login): se pide y se reintenta una vez.
  if (res.status === 403) {
    csrfToken = await loadCsrfToken();
    if (csrfToken) res = await send(url, options);
  }
  if (res.status === 401 && !url.endsWith('/auth/login')) {
    // Fuera de un componente no hay router; una recarga completa además limpia el estado.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign('/admin/login');
    throw new ApiError('La sesión venció', 401, 'UNAUTHENTICATED');
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const adminRequest = <T = unknown>(path: string, options?: RequestOptions) =>
  request<T>(`/api/v1/admin${path}`, options);

export function forgetCsrfToken() {
  csrfToken = null;
}
