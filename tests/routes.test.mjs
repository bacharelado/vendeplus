import test from 'node:test';
import assert from 'node:assert/strict';
import {ROUTES,MOBILE_NAV,readRoute,listingHref,sellerHref,publishDraftHref,publishEditHref} from '../src/lib/routes.mjs';

test('sete páginas principais seguem acessíveis',()=>{
  assert.deepEqual(
    [ROUTES.home,listingHref(1),sellerHref('00000000-0000-4000-8000-000000000001'),ROUTES.login,ROUTES.account,ROUTES.publish,ROUTES.admin].map(hash=>readRoute(hash).name),
    ['inicio','anuncio','vendedor','entrar','area','publicar','admin']
  );
});
test('os caminhos antigos continuam compatíveis',()=>{
  assert.deepEqual(readRoute('#catalogo'),{name:'inicio',section:'ofertas'});
  assert.deepEqual(readRoute('#como-funciona'),{name:'inicio',section:'como-comprar'});
  for(const hash of ['#painel','#conta']) assert.deepEqual(readRoute(hash),{name:'area'});
  assert.deepEqual(readRoute('#cadastro'),{name:'entrar',register:true});
  assert.deepEqual(readRoute('#anunciar'),{name:'publicar'});
  assert.deepEqual(readRoute('#editar-rascunho-1'),{name:'publicar',draftId:'rascunho-1'});
});
test('recuperação de senha preserva os endereços existentes',()=>{
  assert.deepEqual(readRoute(ROUTES.recovery),{name:'entrar',recover:true});
  assert.deepEqual(readRoute('#entrar?redefinir=abc123'),{name:'entrar',recover:true,resetToken:'abc123'});
});
test('edição de anúncios e rascunhos preserva os identificadores',()=>{
  assert.deepEqual(readRoute(publishEditHref(123)),{name:'publicar',editId:123});
  assert.deepEqual(readRoute(publishDraftHref('abc-12')),{name:'publicar',draftId:'abc-12'});
  assert.deepEqual(readRoute('#publicar'),{name:'publicar'});
  assert.deepEqual(readRoute('#publicar?anuncio=nao-e-numero'),{name:'indisponivel'});
});
test('links de anúncio e perfil permanecem compartilháveis',()=>{
  assert.deepEqual(readRoute(listingHref(501)),{name:'anuncio',id:501});
  const sellerId='00000000-0000-4000-8000-000000000001';
  assert.deepEqual(readRoute(sellerHref(sellerId)),{name:'vendedor',sellerId});
});
test('acesso vazio ou inválido não cria rota inesperada',()=>{
  assert.deepEqual(readRoute(''),{name:'inicio'});
  assert.deepEqual(readRoute('#'),{name:'inicio'});
  assert.deepEqual(readRoute('#foo'),{name:'indisponivel'});
  assert.deepEqual(readRoute('#anuncio-abc'),{name:'indisponivel'});
  assert.deepEqual(readRoute('#admin/falso'),{name:'indisponivel'});
});
test('menu móvel possui somente três atalhos das páginas existentes',()=>{
  assert.deepEqual(MOBILE_NAV.map(item=>item.id),['inicio','publicar','area']);
  for(const item of MOBILE_NAV) assert.equal(readRoute(item.href).name,item.id);
});
test('identificadores malformados não abrem outro anúncio nem um formulário novo',()=>{
  for(const hash of ['#anuncio-0','#anuncio-9007199254740993','#publicar?anuncio=0','#publicar?anuncio=9007199254740993','#vendedor-'+'-'.repeat(36)]){
    assert.deepEqual(readRoute(hash),{name:'indisponivel'});
  }
});
