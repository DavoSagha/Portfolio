import { NextResponse, type NextRequest } from 'next/server';

/**
 * CSP con nonce por request: solo corren los scripts que el servidor generó para esa respuesta.
 * Un script inyectado no tiene el nonce y el navegador lo bloquea. Next toma el nonce de esta
 * cabecera y lo aplica a sus propios scripts; los del layout lo leen de `x-nonce`.
 */
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  // React necesita eval solo en desarrollo, para las herramientas de depuración.
  const devEval = process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}`,
    // Tailwind no genera estilos en línea, pero el gráfico del panel usa alturas calculadas y
    // next/font agrega las suyas. Un estilo en línea no puede ejecutar código.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  // Sin archivos estáticos, que no ejecutan nada ni pasan por el render.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
