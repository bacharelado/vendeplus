import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {onRequest} from '../functions/_middleware.ts';

test('applies security headers to Pages responses and preserves existing headers', async () => {
  const response = await onRequest({
    request: new Request('https://vendeplus.pages.dev/api/listings'),
    next: async () => new Response('{"listings":[]}', {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    })
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(response.headers.get('permissions-policy'), 'camera=(), microphone=(), geolocation=()');
  assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');

  const policy = response.headers.get('content-security-policy') || '';
  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /script-src 'self'/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /https:\/\/fonts\.googleapis\.com/);
  assert.match(policy, /https:\/\/fonts\.gstatic\.com/);
  assert.match(policy, /img-src 'self' https:/);
  assert.match(policy, /frame-src https:\/\/drive\.google\.com(?:;|$)/);
  assert.doesNotMatch(policy, /script-src[^;]*(?:unsafe-inline|unsafe-eval|https:)/);
});

test('preserves a real 404 response and its body', async () => {
  const response = await onRequest({
    request: new Request('https://vendeplus.pages.dev/.env'),
    next: async () => new Response('Página não encontrada', {status: 404})
  });

  assert.equal(response.status, 404);
  assert.equal(await response.text(), 'Página não encontrada');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
});

test('does not send HSTS over plain HTTP', async () => {
  const response = await onRequest({
    request: new Request('http://localhost/'),
    next: async () => new Response('ok')
  });

  assert.equal(response.headers.get('strict-transport-security'), null);
});

test('includes a top-level custom 404 page with a link to the SPA home route', async () => {
  const html = await readFile(new URL('../public/404.html', import.meta.url), 'utf8');

  assert.match(html, /<html lang="pt-BR">/);
  assert.match(html, /<title>Página não encontrada \| VENDE\+<\/title>/);
  assert.match(html, /href="\/#inicio"/);
  assert.match(html, /ERRO 404/);
});

test('unknown API routes return a JSON 404 instead of HTML and cannot be cached', async () => {
  const response=await onRequest({request:new Request('https://vendeplus.pages.dev/api/inexistente'),next:async()=>new Response('<html>SPA</html>',{headers:{'Content-Type':'text/html'}})});
  assert.equal(response.status,404);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.match(response.headers.get('content-type'),/application\/json/);
  assert.deepEqual(await response.json(),{error:'Recurso não encontrado.'});
});

test('uncaught errors produce protected generic responses without leaking internals', async () => {
  for(const path of ['/','/api/account/session']){
    const response=await onRequest({request:new Request('https://vendeplus.pages.dev'+path),next:async()=>{throw Error('PRIVATE_DATABASE_ERROR')}});
    assert.equal(response.status,503);
    assert.equal(response.headers.get('retry-after'),'60');
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal(response.headers.get('x-frame-options'),'DENY');
    assert.doesNotMatch(await response.text(),/PRIVATE_DATABASE_ERROR/);
  }
});

test('HEAD preserves status and security headers with an empty body',async()=>{
  const response=await onRequest({request:new Request('https://vendeplus.pages.dev/',{method:'HEAD'}),next:async()=>new Response('VENDE+')});
  assert.equal(response.status,200);
  assert.equal(await response.text(),'');
  assert.ok(response.headers.get('content-security-policy'));
});
