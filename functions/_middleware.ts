type PagesContext = {request: Request; next: () => Promise<Response>};

const policy = [
  "default-src 'self'", "base-uri 'none'", "object-src 'none'",
  "frame-ancestors 'none'", "form-action 'self'", "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com", "img-src 'self' https: data: blob:",
  "connect-src 'self'", "frame-src https://drive.google.com", "worker-src 'none'"
].join('; ');

export async function onRequest({request, next}: PagesContext): Promise<Response> {
  const url = new URL(request.url);
  const api = url.pathname === '/api' || url.pathname.startsWith('/api/');
  let response: Response;
  try {
    response = await next();
    // An unknown API route must not be mistaken for a successful HTML page.
    if (api && response.headers.get('Content-Type')?.includes('text/html')) {
      response = Response.json({error: 'Recurso não encontrado.'}, {status: 404});
    }
  } catch {
    response = api
      ? Response.json({error: 'Serviço temporariamente indisponível.'}, {status: 503})
      : new Response('Não foi possível abrir o VENDE+. Tente novamente em instantes.', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
    response.headers.set('Retry-After', '60');
  }
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', policy + (url.protocol === 'https:' ? '; upgrade-insecure-requests' : ''));
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (url.protocol === 'https:') headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (api || response.status >= 400) headers.set('Cache-Control', 'no-store');
  return new Response(request.method === 'HEAD' ? null : response.body, {status: response.status, statusText: response.statusText, headers});
}
