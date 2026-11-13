// Fonte única dos caminhos públicos do VENDE+.
// Hash routing mantém os links compartilhados funcionando no Cloudflare Pages.
export const ROUTES = Object.freeze({
  home: '#inicio',
  catalog: '#catalogo',
  howItWorks: '#como-funciona',
  login: '#entrar',
  register: '#cadastro',
  recovery: '#entrar?recuperar',
  account: '#area',
  publish: '#publicar',
  admin: '#admin',
});

export const MOBILE_NAV = Object.freeze([
  {id:'inicio',label:'Início e busca',icon:'home',href:ROUTES.home},
  {id:'publicar',label:'Anunciar',icon:'plus',href:ROUTES.publish},
  {id:'area',label:'Minha área',icon:'user',href:ROUTES.account},
]);

export const listingHref = id => '#anuncio-' + id;
export const sellerHref = id => '#vendedor-' + id;
export const publishDraftHref = id => '#publicar?rascunho=' + id;
export const publishEditHref = id => '#publicar?anuncio=' + id;

// Esta função não acessa o navegador: pode ser testada sem DOM.
export function readRoute(rawHash = '') {
  const hash = String(rawHash).replace(/^#/, '') || 'inicio';
  if (hash === 'entrar?recuperar') return {name:'entrar',recover:true};
  if (hash.startsWith('entrar?redefinir=')) return {name:'entrar',recover:true,resetToken:hash.slice('entrar?redefinir='.length)};
  const listing = /^anuncio-(\d+)$/.exec(hash);
  if (listing) return {name:'anuncio',id:Number(listing[1])};
  const seller = /^vendedor-([a-f0-9-]{36})$/.exec(hash);
  if (seller) return {name:'vendedor',sellerId:seller[1]};
  const draft = /^editar-([a-zA-Z0-9-]+)$/.exec(hash);
  if (draft) return {name:'publicar',draftId:draft[1]};
  const publish = /^publicar(?:\?(rascunho|anuncio)=([a-zA-Z0-9-]+))?$/.exec(hash);
  if (publish) return {name:'publicar',...(publish[1]==='rascunho'?{draftId:publish[2]}:publish[1]==='anuncio'&&/^\d+$/.test(publish[2])?{editId:Number(publish[2])}:{})};
  if (hash === 'catalogo') return {name:'inicio',section:'ofertas'};
  if (hash === 'como-funciona') return {name:'inicio',section:'como-comprar'};
  if (hash === 'painel' || hash === 'conta') return {name:'area'};
  if (hash === 'cadastro') return {name:'entrar'};
  if (hash === 'anunciar') return {name:'publicar'};
  return {name:['inicio','entrar','area','publicar','admin'].includes(hash)?hash:'indisponivel'};
}
