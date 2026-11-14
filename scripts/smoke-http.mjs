import assert from 'node:assert/strict';

const target = new URL(process.argv[2] || 'https://vendeplus.pages.dev/');
if (target.protocol !== 'https:' || !/^(?:[a-z0-9-]+\.)?vendeplus\.pages\.dev$/.test(target.hostname) || target.port || target.username || target.password) {
  throw Error('Informe somente a origem HTTPS oficial ou uma prévia Cloudflare Pages do VENDE+.');
}
const origin = target.origin;
async function check(path, expected, inspect) {
  const response = await fetch(origin + path, {redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
  assert.equal(response.status, expected, `${path}: HTTP inesperado`);
  assert.equal(response.headers.get('x-content-type-options'),'nosniff',path);
  assert.equal(response.headers.get('x-frame-options'),'DENY',path);
  assert.ok(response.headers.get('strict-transport-security'),path);
  const csp=response.headers.get('content-security-policy')||'';
  assert.match(csp,/script-src 'self'/,path);
  assert.match(csp,/frame-src https:\/\/drive\.google\.com(?:;|$)/,path);
  if(path.startsWith('/api/'))assert.equal(response.headers.get('cache-control'),'no-store',path);
  if(inspect)await inspect(response);
  else await response.body?.cancel();
  console.log(`PASS GET ${path} → ${expected}`);
}
await check('/',200,async response=>assert.match(await response.text(),/VENDE\+/));
await check('/api/listings',200,async response=>assert.ok(Array.isArray((await response.json()).listings)));
await check('/api/account/session',200,async response=>assert.equal((await response.json()).account,null));
await check('/api/listings?id=invalido',400);
await check('/api/rota-inexistente-auditoria',404,async response=>assert.equal(typeof (await response.json()).error,'string'));
for(const path of ['/pagina-inexistente-auditoria','/.env','/.git/config'])await check(path,404);
console.log('Verificação HTTP concluída sem criar ou alterar registros.');
