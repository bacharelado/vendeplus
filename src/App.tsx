import {useEffect,useRef,useState,type ReactNode} from 'react';
import {categories,type Listing} from './data/marketplace';
import {SellerArea} from './components/SellerArea';
import {PasswordRecovery} from './components/PasswordRecovery';
import {ListingCard} from './components/ListingCard';
import {SellerPublicProfile} from './components/SellerPublicProfile';
import {ReportListing} from './components/ReportListing';
import {Icon} from './components/Icon';
import {ContactLink} from './components/ContactLink';
import {VideoFeature} from './components/VideoFeature';
import {filterListings} from './lib/catalog.mjs';
import {formatBRL} from './lib/pricing.mjs';
import {fetchCatalogPage,fetchListing,type CatalogState} from './lib/api';
import {ROUTES,MOBILE_NAV,readRoute,listingHref,sellerHref} from './lib/routes.mjs';

function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';ref.current?.showModal();
    const dialog=ref.current;
    return ()=>{dialog?.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus({preventScroll:true})};
  },[]);
  return <dialog ref={ref} className="modal" aria-label={title} onCancel={e=>{e.preventDefault();onClose()}} onKeyDown={e=>{
    if(e.key!=='Tab')return;
    const items=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,textarea')).filter(el=>el.getClientRects().length>0);
    if(e.shiftKey?document.activeElement===items[0]:document.activeElement===items.at(-1)){e.preventDefault();(e.shiftKey?items.at(-1):items[0])?.focus()}
  }}>
    <div className="dialog-heading"><h2>{title}</h2><button className="icon-button" aria-label="Fechar" onClick={onClose} autoFocus><Icon name="close"/></button></div>{children}
  </dialog>;
}
function Empty({title,children,icon='bag'}:{title:string;children:ReactNode;icon?:string}){
  return <div className="empty-state"><span className="empty-icon"><Icon name={icon}/></span><h2>{title}</h2><div className="empty-copy">{children}</div></div>;
}
export function App(){
  const [route,setRoute]=useState(()=>readRoute(location.hash));
  const [catalog,setCatalog]=useState<CatalogState>({kind:'loading',listings:[]});
  const [refresh,setRefresh]=useState(0);
  const [nextCursor,setNextCursor]=useState<string>();
  const [loadingMore,setLoadingMore]=useState(false);
  const catalogVersion=useRef(0);
  const [detail,setDetail]=useState<{id?:number;kind:'loading'|'ready'|'unavailable';listing?:Listing}>({kind:'loading'});
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('Todas');
  const [neighborhood,setNeighborhood]=useState('Todos');
  const [sortOrder,setSortOrder]=useState<'recentes'|'menor'|'maior'>('recentes');
  const [notice,setNotice]=useState('');
  const [dialog,setDialog]=useState<{title:string;content:ReactNode}|null>(null);
  const mainRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    const onHash=()=>{setDialog(null);setNotice('');setRoute(readRoute(location.hash));window.scrollTo(0,0);requestAnimationFrame(()=>mainRef.current?.focus({preventScroll:true}))};
    window.addEventListener('hashchange',onHash);return ()=>window.removeEventListener('hashchange',onHash);
  },[]);
  useEffect(()=>{
    if(route.name!=='inicio')return;
    const controller=new AbortController();
    const timer=window.setTimeout(()=>controller.abort(),8000);
    catalogVersion.current++;setNextCursor(undefined);
    setCatalog({kind:'loading',listings:[]});
    let disposed=false;
    fetchCatalogPage(controller.signal).then(page=>{if(!disposed){setCatalog({kind:'ready',listings:page.listings});setNextCursor(page.nextCursor)}}).catch(()=>{if(!disposed)setCatalog({kind:'unavailable',listings:[]})}).finally(()=>clearTimeout(timer));
    return ()=>{disposed=true;controller.abort();clearTimeout(timer)};
  },[refresh,route.name]);
  useEffect(()=>{const titles:Record<string,string>={inicio:'Compre e venda em Poranga e Jacarezinho',entrar:route.recover?'Recuperar senha':'Entrar ou cadastrar',area:'Minha área',publicar:route.editId?'Editar anúncio':'Publicar anúncio',admin:'Administração',anuncio:'Detalhes do anúncio',vendedor:'Perfil do vendedor'};document.title=`${titles[route.name]||'Página não encontrada'} | VENDE+`},[route.name,route.editId,route.recover]);
  useEffect(()=>{if(route.section)requestAnimationFrame(()=>document.getElementById(route.section!)?.scrollIntoView({block:'start'}))},[route.name,route.section]);
  useEffect(()=>{if(route.name==='anuncio'&&detail.kind==='ready'&&detail.id===route.id&&detail.listing){document.title=`${detail.listing.title} | VENDE+`}},[route.name,route.id,detail]);
  const reset=()=>{setQuery('');setCategory('Todas');setNeighborhood('Todos');setSortOrder('recentes')};
  const browse=()=>{reset();if(route.name!=='inicio')location.hash=ROUTES.catalog;else document.getElementById('ofertas')?.scrollIntoView({behavior:'smooth',block:'start'})};
  const filtered=filterListings(catalog.listings,{query,category,neighborhood,sortOrder});
  const browsing=Boolean(query.trim()||category!=='Todas'||neighborhood!=='Todos');
  const sparse=catalog.kind==='ready'&&!browsing&&filtered.length>0&&filtered.length<=2;
  const active=detail.id===route.id&&detail.kind==='ready'?detail.listing:undefined;
  useEffect(()=>{
    if(route.name!=='anuncio'||!route.id)return;
    const id=route.id,controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),8000);let disposed=false;
    setDetail({id,kind:'loading'});
    fetchListing(id,controller.signal).then(listing=>{if(!disposed)setDetail({id,kind:'ready',listing})}).catch(()=>{if(!disposed)setDetail({id,kind:'unavailable'})}).finally(()=>clearTimeout(timer));
    return ()=>{disposed=true;controller.abort();clearTimeout(timer)};
  },[route.name,route.id,refresh]);
  const more=async()=>{
    if(!nextCursor||loadingMore)return;
    setLoadingMore(true);setNotice('');const version=catalogVersion.current;
    try{const page=await fetchCatalogPage(AbortSignal.timeout(8000),nextCursor);if(version!==catalogVersion.current)return;setCatalog(current=>current.kind==='ready'?{kind:'ready',listings:[...new Map([...current.listings,...page.listings].map(item=>[item.id,item])).values()]}:current);setNextCursor(page.nextCursor)}
    catch{setNotice('Não foi possível carregar mais anúncios. Tente novamente.')}finally{setLoadingMore(false)}
  };
  const share=async(listing:Listing)=>{
    const link=location.origin+location.pathname+listingHref(listing.id);
    let copied=false;try{await navigator.clipboard.writeText(link);copied=true}catch{}
    setDialog({title:copied?'Link copiado':'Compartilhar anúncio',content:<><p>{copied?'Envie o endereço para quem pode se interessar.':'Selecione o endereço abaixo para copiar e enviar.'}</p><label className="share-label">Link do anúncio<input readOnly value={link} onFocus={e=>e.currentTarget.select()}/></label></>});
  };
  useEffect(()=>{const reload=()=>{if(document.visibilityState==='visible'&&['inicio','anuncio'].includes(route.name))setRefresh(value=>value+1)};document.addEventListener('visibilitychange',reload);return ()=>document.removeEventListener('visibilitychange',reload)},[route.name]);
  const catalogContent=()=>catalog.kind==='loading'?<div className="catalog-loading" role="status"><span className="spinner"/>Buscando anúncios…</div>:catalog.kind==='unavailable'?<Empty title="Não foi possível carregar os anúncios"><p>Tente novamente em alguns instantes.</p><button className="button outline" onClick={()=>setRefresh(v=>v+1)}>Tentar novamente</button></Empty>:filtered.length?<div className="product-grid">{filtered.map(item=><ListingCard key={item.id} listing={item}/>)}</div>:browsing?<Empty title="Nenhum anúncio encontrado" icon="search"><p>Experimente outra busca ou explore todas as categorias.</p><button className="button outline" onClick={reset}>Ver todos os anúncios</button></Empty>:<Empty title="Ainda não há anúncios no bairro" icon="search"><p>O VENDE+ cresce com anúncios reais. Que tal começar pelo seu?</p><a className="button primary" href={ROUTES.publish}>Publicar meu anúncio</a></Empty>;
  return <div className="app dark">
    <a href="#conteudo" className="skip-link" onClick={e=>{e.preventDefault();mainRef.current?.focus()}}>Pular para o conteúdo</a>
    <div className="location-strip"><div className="container"><span><Icon name="pin"/>Feito para Poranga e Jacarezinho</span></div></div>
    <header className="topbar buyer-header"><div className="container header-row"><a className="brand" href={ROUTES.home} aria-label="VENDE+ início">VENDE<span>+</span></a><nav aria-label="Menu principal"><a href={ROUTES.home} onClick={e=>{e.preventDefault();browse()}} aria-current={route.name==='inicio'?'page':undefined}>Ver anúncios</a><a href={ROUTES.account} aria-current={route.name==='area'?'page':undefined}>Minha área</a></nav><a href={ROUTES.publish} className="button primary seller-cta"><Icon name="plus"/>Anunciar</a></div></header>
    <main ref={mainRef} id="conteudo" tabIndex={-1} className="container main">
      {notice&&<div className="notice" role="status">{notice}<button className="icon-button" onClick={()=>setNotice('')} aria-label="Fechar aviso"><Icon name="close"/></button></div>}
      {route.name==='inicio'&&<div className="buyer-home marketplace-home">
        <section className="discover-hero" aria-label="Encontre no VENDE+">
          <div className="discover-hero-copy">
            <span className="discover-eyebrow"><Icon name="pin"/> O MARKETPLACE DO SEU BAIRRO</span>
            <h1>Tudo perto de você.<span> Em um só lugar.</span></h1>
            <p>Encontre produtos e serviços em Poranga I, Poranga II e Jacarezinho. Negocie direto com quem anuncia.</p>
            <label className="simple-market-search discover-search">
              <Icon name="search"/>
              <input name="q" type="search" aria-label="Buscar anúncios" placeholder="O que você está procurando?" value={query} onChange={e=>setQuery(e.target.value)} autoComplete="off"/>
              {query&&<button type="button" aria-label="Limpar busca" title="Limpar busca" onClick={()=>setQuery('')}><Icon name="close"/></button>}
            </label>
          </div>
          <aside className="discover-hero-panel" aria-label="Por que usar o VENDE+">
            <span className="discover-panel-kicker">SEU BAIRRO, SUAS OPORTUNIDADES</span>
            <div className="discover-panel-mark">VENDE<span>+</span></div>
            <div className="discover-panel-list"><span><Icon name="check"/> Explore sem cadastro</span><span><Icon name="message-circle"/> Contato pelo WhatsApp</span><span><Icon name="pin"/> Negocie perto de casa</span></div>
            <a href={ROUTES.publish} className="discover-panel-link">Quero anunciar <Icon name="arrow"/></a>
          </aside>
        </section>

        <section className="market-categories" aria-labelledby="market-categories-title">
          <div className="market-categories-heading"><h2 id="market-categories-title">Explore por categoria</h2><span>Escolha o que combina com você</span></div>
          <div className="market-chip-row" role="group" aria-label="Categorias dos anúncios">
            <button type="button" className="market-chip" aria-pressed={category==='Todas'} onClick={()=>{setCategory('Todas');document.getElementById('ofertas')?.scrollIntoView({behavior:'smooth',block:'start'})}}><span className="market-chip-symbol">✦</span> Todos</button>
            {categories.map(item=><button type="button" key={item.name} className="market-chip" aria-pressed={category===item.name} onClick={()=>{setCategory(current=>current===item.name?'Todas':item.name);document.getElementById('ofertas')?.scrollIntoView({behavior:'smooth',block:'start'})}}><span className="market-chip-symbol" aria-hidden="true">{item.emoji}</span>{item.name}</button>)}
          </div>
        </section>

        <section id="ofertas" className="buyer-offers market-offers" aria-label="Anúncios do bairro">
          <div className="market-offers-heading">
            <div><span className="market-section-kicker">DESCUBRA PERTO DE VOCÊ</span><h2>Anúncios do bairro</h2><p>Veja o que as pessoas estão anunciando.</p></div>
            <div className="market-offers-tools">
              {catalog.kind==='ready'&&<span className="simple-market-count" role="status" aria-live="polite">{filtered.length} {filtered.length===1?'anúncio':'anúncios'}</span>}
              {(browsing||sortOrder!=='recentes')&&<button type="button" className="market-reset" onClick={reset}>Ver tudo <Icon name="close"/></button>}
            </div>
          </div>
          <div className="catalog-controls">
            <p className="catalog-context">{query.trim()?<>Resultados para <strong>“{query.trim()}”</strong></>:'Explore as ofertas do bairro'}{category!=='Todas'&&<> · {category}</>}</p>
            <div className="catalog-selects">
              <label><span>Bairro</span><select value={neighborhood} onChange={e=>setNeighborhood(e.target.value)}><option value="Todos">Todos os bairros</option><option>Poranga I</option><option>Poranga II</option><option>Jacarezinho</option></select></label>
              <label><span>Ordenar por</span><select value={sortOrder} onChange={e=>setSortOrder(e.target.value as 'recentes'|'menor'|'maior')}><option value="recentes">Mais recentes</option><option value="menor">Menor preço</option><option value="maior">Maior preço</option></select></label>
            </div>
          </div>
          {nextCursor&&<p className="catalog-page-hint">A busca e a ordenação consideram os {catalog.listings.length} anúncios carregados. Use “Ver mais anúncios” para ampliar os resultados.</p>}
          <div className={sparse?'market-showcase market-showcase--sparse'+(filtered.length===1?' market-showcase--single':''):'market-showcase'}>
            {catalogContent()}
            {sparse&&<aside className="market-discovery-aside" aria-label="Anuncie no VENDE+">
              <div className="market-discovery-stamp"><Icon name="plus"/></div>
              <span className="market-section-kicker">TEM ESPAÇO PRA VOCÊ</span>
              <h3>Seu próximo anúncio pode estar aqui.</h3>
              <p>Tem algo para vender ou um serviço para oferecer? Publique no bairro e converse diretamente com interessados.</p>
              <a className="button primary" href={ROUTES.publish}><Icon name="plus"/> Criar meu anúncio</a>
            </aside>}
          </div>
          {nextCursor&&catalog.kind==='ready'&&<button className="button outline full" disabled={loadingMore} onClick={()=>void more()}>{loadingMore?'Carregando…':'Ver mais anúncios'}</button>}
        </section>

        <VideoFeature/>

        <section id="como-comprar" className="market-guide" aria-labelledby="market-guide-title">
          <div className="market-guide-heading"><span className="market-section-kicker">SIMPLES ASSIM</span><h2 id="market-guide-title">Encontre, converse e combine.</h2><p>O VENDE+ conecta pessoas do bairro. A negociação é feita diretamente entre comprador e vendedor.</p></div>
          <div className="market-guide-steps">
            <div><span className="market-guide-icon"><Icon name="search"/></span><strong>1. Explore anúncios</strong><p>Encontre produtos e serviços que estão sendo oferecidos.</p></div>
            <div><span className="market-guide-icon"><Icon name="message-circle"/></span><strong>2. Chame no WhatsApp</strong><p>Converse diretamente com a pessoa que anunciou.</p></div>
            <div><span className="market-guide-icon"><Icon name="shield"/></span><strong>3. Combine com cuidado</strong><p>Confira o produto e combine entrega e pagamento entre vocês.</p></div>
          </div>
        </section>
        <section className="market-seller-callout" aria-label="Comece a vender">
          <div><span className="market-section-kicker">VOCÊ TAMBÉM PODE ANUNCIAR</span><h2>Tem algo para vender?</h2><p>Seu espaço no VENDE+ está pronto para receber seu anúncio.</p></div>
          <a className="button primary" href={ROUTES.publish}><Icon name="plus"/> Anunciar agora</a>
        </section>
        <p className="buyer-safety"><Icon name="shield"/>Confira o produto e combine a entrega antes de pagar. O VENDE+ não intermedeia pagamentos.</p>
      </div>}
      {route.name==='anuncio'&&(active?<><a href={ROUTES.catalog} className="back"><Icon name="arrow"/>Voltar às ofertas</a><div className="detail"><div className="detail-media"><span aria-hidden="true">{categories.find(c=>c.name===active.category)?.emoji}</span>{active.image&&<img src={active.image} alt={active.title} referrerPolicy="no-referrer" onError={e=>{e.currentTarget.hidden=true}}/>}</div><div className="detail-copy"><span className="eyebrow">{active.category} · {active.condition}</span><h1>{active.title}</h1><strong className="big-price">{formatBRL(active.priceCents)}</strong><span className="detail-location"><Icon name="pin"/>{active.neighborhood||'Poranga e Jacarezinho'}</span><div className="seller-box"><span className="seller-avatar"><Icon name="user"/></span><div><small>Anunciado por</small><a className="text-link" href={active.sellerId?sellerHref(active.sellerId):ROUTES.catalog}><strong>{active.seller}</strong></a></div></div>{active.contactWhatsapp?<ContactLink listing={active}/>:<p className="contact-unavailable">Contato do anunciante indisponível no momento.</p>}<button className="button outline full" onClick={()=>void share(active)}>Compartilhar anúncio</button><ReportListing listingId={active.id}/><h2>Sobre esta oferta</h2><p className="description">{active.description}</p><h2>Como será a entrega?</h2><p>{active.fulfillment}</p><div className="safety-note"><Icon name="shield"/><p>Confira o produto e combine as condições diretamente com quem anuncia. O VENDE+ não recebe nem intermedeia pagamentos.</p></div></div></div></>:detail.id!==route.id||detail.kind==='loading'?<div role="status" className="catalog-loading">Carregando anúncio…</div>:<Empty title={detail.kind==='unavailable'?'Não foi possível carregar esta oferta':'Esta oferta não está disponível'}><p>{detail.kind==='unavailable'?'Tente novamente em alguns instantes.':'Ela pode ter sido encerrada ou retirada do catálogo.'}</p><a className="button primary" href={ROUTES.catalog}>Ver anúncios</a></Empty>)}
      {route.name==='vendedor'&&route.sellerId&&<SellerPublicProfile key={route.sellerId} id={route.sellerId}/>}
      {route.recover&&<PasswordRecovery key={route.resetToken||'request'} token={route.resetToken}/>}
      {!route.recover&&['entrar','area','publicar'].includes(route.name)&&<SellerArea key={route.name+':'+(route.draftId||route.editId||(route.register?'cadastro':''))} view={route.name as 'entrar'|'area'|'publicar'} draftId={route.draftId} editId={route.editId}/>}
      {route.name==='admin'&&<SellerArea admin/>}
      {route.name==='indisponivel'&&<Empty title="Página não encontrada" icon="search"><p>Continue explorando as oportunidades do bairro.</p><a href={ROUTES.home} className="button primary">Voltar ao início</a></Empty>}
    </main>
    <footer className="footer"><div className="container footer-grid"><div><a className="brand" href={ROUTES.home}>VENDE<span>+</span></a><p>O comércio do seu bairro,<br/>com novas possibilidades.</p><span className="footer-location"><Icon name="pin"/>Poranga e Jacarezinho</span></div><div><h2>VENDE+</h2><a href={ROUTES.catalog}>Ver anúncios</a><a href={ROUTES.account}>Minha área</a><p>Um produto APOCALYPTIC.</p></div><div className="footer-contact"><h2>Fale com o criador</h2><p>Conecte-se com Helio ou fale diretamente pelo WhatsApp.</p><div className="footer-socials" aria-label="Redes sociais e contato do criador"><a className="footer-social" href="https://www.facebook.com/semessademehackear" target="_blank" rel="noopener noreferrer" aria-label="Facebook pessoal de Helio"><Icon name="facebook"/><span>Facebook</span></a><a className="footer-social" href="https://www.instagram.com/euuheliooaq" target="_blank" rel="noopener noreferrer" aria-label="Instagram pessoal de Helio"><Icon name="instagram"/><span>Instagram</span></a><a className="footer-social" href="https://wa.me/559281660856" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp pessoal de Helio"><Icon name="whatsapp"/><span>WhatsApp</span></a></div></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} VENDE+ · APOCALYPTIC</span><span>Negocie com atenção. Valorize o comércio local.</span></div></footer>
    <nav className="mobile-bottom" aria-label="Atalhos para celular">{MOBILE_NAV.map(({id,label,icon,href})=><a key={id} href={href} aria-current={route.name===id?'page':undefined}><Icon name={icon}/>{label}</a>)}</nav>
    {dialog&&<Modal title={dialog.title} onClose={()=>setDialog(null)}>{dialog.content}</Modal>}
  </div>;
}
