import {useEffect,useRef,useState,type ReactNode} from 'react';
import {categories,type Listing} from './data/marketplace';
import {SellerArea} from './components/SellerArea';
import {ListingCard} from './components/ListingCard';
import {SellerPublicProfile} from './components/SellerPublicProfile';
import {ReportListing} from './components/ReportListing';
import {Icon} from './components/Icon';
import {ContactLink} from './components/ContactLink';
import {filterListings} from './lib/catalog.mjs';
import {formatBRL} from './lib/pricing.mjs';
import {fetchCatalogPage,fetchListing,type CatalogState} from './lib/api';

const categoryIcons:Record<string,string>={'Alimentação':'food','Moda':'shirt','Eletrônicos':'phone','Casa':'home','Beleza':'sparkles','Serviços':'tool'};

type Route={name:string;id?:number;draftId?:string;sellerId?:string;editId?:number;section?:string};
function readRoute():Route{
 const hash=location.hash.slice(1)||'inicio';
 const listing=/^anuncio-(\d+)$/.exec(hash);
 if(listing)return {name:'anuncio',id:Number(listing[1])};
 const seller=/^vendedor-([a-f0-9-]{36})$/.exec(hash);
 if(seller)return {name:'vendedor',sellerId:seller[1]};
 const draft=/^editar-([a-zA-Z0-9-]+)$/.exec(hash);
 if(draft)return {name:'publicar',draftId:draft[1]};
 const publish=/^publicar(?:\?(rascunho|anuncio)=([a-zA-Z0-9-]+))?$/.exec(hash);
 if(publish)return {name:'publicar',...(publish[1]==='rascunho'?{draftId:publish[2]}:publish[1]==='anuncio'&&/^\d+$/.test(publish[2])?{editId:Number(publish[2])}:{})};
 if(hash==='catalogo')return {name:'inicio',section:'ofertas'};
 if(hash==='como-funciona')return {name:'inicio',section:'como-comprar'};
 if(hash==='painel'||hash==='conta')return {name:'area'};
 if(hash==='cadastro')return {name:'entrar'};
 if(hash==='anunciar')return {name:'publicar'};
 return {name:['inicio','entrar','area','publicar','admin'].includes(hash)?hash:'indisponivel'};
}
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
  const [route,setRoute]=useState(readRoute);
  const [catalog,setCatalog]=useState<CatalogState>({kind:'loading',listings:[]});
  const [refresh,setRefresh]=useState(0);
  const [nextCursor,setNextCursor]=useState<string>();
  const [loadingMore,setLoadingMore]=useState(false);
  const catalogVersion=useRef(0);
  const [detail,setDetail]=useState<{id?:number;kind:'loading'|'ready'|'unavailable';listing?:Listing}>({kind:'loading'});
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('Todas');
  const [condition,setCondition]=useState('Todas');
  const [neighborhood,setNeighborhood]=useState('Todos');
  const [order,setOrder]=useState<'recentes'|'menor'|'maior'>('recentes');
  const [dark,setDark]=useState(()=>{try{return localStorage.getItem('vendeplus:theme')==='dark'}catch{return false}});
  const [notice,setNotice]=useState('');
  const [dialog,setDialog]=useState<{title:string;content:ReactNode}|null>(null);
  const mainRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    const onHash=()=>{setDialog(null);setNotice('');setRoute(readRoute());window.scrollTo(0,0);requestAnimationFrame(()=>mainRef.current?.focus({preventScroll:true}))};
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
  useEffect(()=>{const titles:Record<string,string>={inicio:'Compre e venda em Poranga e Jacarezinho',entrar:'Entrar ou cadastrar',area:'Minha área',publicar:route.editId?'Editar anúncio':'Publicar anúncio',admin:'Administração',anuncio:'Detalhes do anúncio',vendedor:'Perfil do vendedor'};document.title=`${titles[route.name]||'Página não encontrada'} | VENDE+`},[route.name,route.editId]);
  useEffect(()=>{if(route.section)requestAnimationFrame(()=>document.getElementById(route.section!)?.scrollIntoView({block:'start'}))},[route.name,route.section]);
  useEffect(()=>{if(route.name==='anuncio'&&detail.kind==='ready'&&detail.id===route.id&&detail.listing){document.title=`${detail.listing.title} | VENDE+`}},[route.name,route.id,detail]);
  useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';try{localStorage.setItem('vendeplus:theme',dark?'dark':'light')}catch{}},[dark]);
  const changeTheme=()=>setDark(value=>!value);
  const reset=()=>{setQuery('');setCategory('Todas');setCondition('Todas');setNeighborhood('Todos');setOrder('recentes')};
  const browse=(nextCategory='Todas')=>{reset();setCategory(nextCategory);if(route.name!=='inicio')location.hash='catalogo';else document.getElementById('ofertas')?.scrollIntoView({behavior:'smooth',block:'start'})};
  const filtered=filterListings(catalog.listings,{query,category,condition,neighborhood,sortOrder:order});
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
    const link=location.origin+location.pathname+'#anuncio-'+listing.id;
    let copied=false;try{await navigator.clipboard.writeText(link);copied=true}catch{}
    setDialog({title:copied?'Link copiado':'Compartilhar anúncio',content:<><p>{copied?'Envie o endereço para quem pode se interessar.':'Selecione o endereço abaixo para copiar e enviar.'}</p><label className="share-label">Link do anúncio<input readOnly value={link} onFocus={e=>e.currentTarget.select()}/></label></>});
  };
  useEffect(()=>{const reload=()=>{if(document.visibilityState==='visible'&&['inicio','anuncio'].includes(route.name))setRefresh(value=>value+1)};document.addEventListener('visibilitychange',reload);return ()=>document.removeEventListener('visibilitychange',reload)},[route.name]);
  const catalogContent=()=>catalog.kind==='loading'?<div className="catalog-loading" role="status"><span className="spinner"/>Buscando anúncios…</div>:catalog.kind==='unavailable'?<Empty title="Não foi possível carregar os anúncios"><p>Tente novamente em alguns instantes.</p><button className="button outline" onClick={()=>setRefresh(v=>v+1)}>Tentar novamente</button></Empty>:filtered.length?<div className="product-grid">{filtered.map(item=><ListingCard key={item.id} listing={item}/>)}</div>:<Empty title={catalog.listings.length?'Nenhum anúncio encontrado':'Ainda não há anúncios no bairro'} icon="search"><p>{catalog.listings.length?'Tente outra palavra ou escolha outra categoria.':'Seja o primeiro a anunciar em Poranga e Jacarezinho.'}</p>{catalog.listings.length?<button className="button outline" onClick={reset}>Limpar filtros</button>:<div className="empty-actions"><a className="button primary" href="#publicar">Publicar meu anúncio</a></div>}</Empty>;
  return <div className={dark?'app dark':'app'}>
    <a href="#conteudo" className="skip-link" onClick={e=>{e.preventDefault();mainRef.current?.focus()}}>Pular para o conteúdo</a>
    <div className="location-strip"><div className="container"><span><Icon name="pin"/>Feito para Poranga e Jacarezinho, Itacoatiara</span></div></div>
    <header className="topbar buyer-header"><div className="container header-row"><a className="brand" href="#inicio" aria-label="VENDE+ início">VENDE<span>+</span></a><nav aria-label="Menu principal"><a href="#inicio" onClick={e=>{e.preventDefault();browse()}} aria-current={route.name==='inicio'?'page':undefined}>Ver anúncios</a><a href="#area" aria-current={route.name==='area'?'page':undefined}>Minha área</a></nav><a href="#publicar" className="button primary seller-cta"><Icon name="plus"/>Anunciar</a><button type="button" className="icon-button theme" onClick={changeTheme} aria-label="Alternar tema" aria-pressed={dark} title={dark?'Ativar tema claro':'Ativar tema escuro'}><Icon name={dark?'sun':'moon'}/></button></div></header>
    <main ref={mainRef} id="conteudo" tabIndex={-1} className="container main">
      {notice&&<div className="notice" role="status">{notice}<button className="icon-button" onClick={()=>setNotice('')} aria-label="Fechar aviso"><Icon name="close"/></button></div>}
      {route.name==='inicio'&&<div className="buyer-home">
        <section className="hero buyer-hero">
          <div className="hero-copy">
            <span className="eyebrow"><Icon name="pin"/> O comércio pertinho de você</span>
            <h1>Encontre no bairro.</h1>
            <p>Poranga I, Poranga II e Jacarezinho. Negocie direto pelo WhatsApp.</p>
            <form className="search" onSubmit={e=>{e.preventDefault();document.getElementById('ofertas')?.scrollIntoView({behavior:'smooth',block:'start'})}}>
              <Icon name="search"/>
              <input name="q" aria-label="Pesquisar no bairro" placeholder="O que você procura?" value={query} onChange={e=>setQuery(e.target.value)} autoComplete="off"/>
              <button className="button primary">Buscar<Icon name="arrow"/></button>
            </form>
            <div className="buyer-benefits"><span><Icon name="check"/> Comprar sem cadastro</span><span><Icon name="message-circle"/> Contato direto no WhatsApp</span></div>
          </div>

        </section>

        <section className="category-section" aria-label="Categorias de produtos e serviços"><div className="section-heading"><h2>Escolha uma categoria</h2></div><div className="category-grid">{categories.map(item=><button className="category" aria-pressed={category===item.name} key={item.name} onClick={()=>browse(item.name)}><span aria-hidden="true"><Icon name={categoryIcons[item.name]}/></span><strong>{item.name}</strong></button>)}</div></section>
        <section id="ofertas" className="buyer-offers" aria-label="Anúncios e filtros"><div className="section-heading"><h2>Anúncios do bairro</h2>{catalog.kind==='ready'&&<span className="count" role="status">{filtered.length} {filtered.length===1?'oferta':'ofertas'}</span>}</div><div className="filters"><label className="filter-select"><span>Bairro</span><select aria-label="Bairro" value={neighborhood} onChange={e=>setNeighborhood(e.target.value)}><option>Todos</option><option>Poranga I</option><option>Poranga II</option><option>Jacarezinho</option></select></label><label className="filter-select"><span>Condição</span><select aria-label="Condição" value={condition} onChange={e=>setCondition(e.target.value)}><option>Todas</option><option>Novo</option><option>Usado</option><option>Não aplicável</option></select></label><label className="filter-select"><span>Ordenar por</span><select aria-label="Ordenação" value={order} onChange={e=>setOrder(e.target.value as typeof order)}><option value="recentes">Mais recentes</option><option value="menor">Menor preço</option><option value="maior">Maior preço</option></select></label></div>{(query||category!=='Todas'||condition!=='Todas'||neighborhood!=='Todos')&&<div className="filter-feedback"><span>{category==='Todas'?'Todas as categorias':category}</span><button onClick={reset}>Limpar filtros</button></div>}{catalogContent()}{nextCursor&&catalog.kind==='ready'&&<p className="field-help">Os filtros mostram os anúncios carregados. Toque abaixo para ver mais.</p>}{nextCursor&&catalog.kind==='ready'&&<button className="button outline full" disabled={loadingMore} onClick={()=>void more()}>{loadingMore?'Carregando…':'Ver mais anúncios'}</button>}</section>


        <p id="como-comprar" className="buyer-safety"><Icon name="shield"/>Confira o produto e combine a entrega antes de pagar. A negociação é feita diretamente com quem anuncia.</p>
      </div>}
      {route.name==='anuncio'&&(active?<><a href="#catalogo" className="back"><Icon name="arrow"/>Voltar às ofertas</a><div className="detail"><div className="detail-media"><span aria-hidden="true">{categories.find(c=>c.name===active.category)?.emoji}</span>{active.image&&<img src={active.image} alt={active.title} referrerPolicy="no-referrer" onError={e=>{e.currentTarget.hidden=true}}/>}</div><div className="detail-copy"><span className="eyebrow">{active.category} · {active.condition}</span><h1>{active.title}</h1><strong className="big-price">{formatBRL(active.priceCents)}</strong><span className="detail-location"><Icon name="pin"/>{active.neighborhood||'Poranga e Jacarezinho'}, Itacoatiara</span><div className="seller-box"><span className="seller-avatar"><Icon name="user"/></span><div><small>Anunciado por</small><a className="text-link" href={active.sellerId?'#vendedor-'+active.sellerId:'#catalogo'}><strong>{active.seller}</strong></a></div></div>{active.contactWhatsapp?<ContactLink listing={active}/>:<p className="contact-unavailable">Contato do anunciante indisponível no momento.</p>}<button className="button outline full" onClick={()=>void share(active)}>Compartilhar anúncio</button><ReportListing listingId={active.id}/><h2>Sobre esta oferta</h2><p className="description">{active.description}</p><h2>Como será a entrega?</h2><p>{active.fulfillment}</p><div className="safety-note"><Icon name="shield"/><p>Confira o produto e combine as condições diretamente com quem anuncia. O VENDE+ não recebe nem intermedeia pagamentos.</p></div></div></div></>:detail.id!==route.id||detail.kind==='loading'?<div role="status" className="catalog-loading">Carregando anúncio…</div>:<Empty title={detail.kind==='unavailable'?'Não foi possível carregar esta oferta':'Esta oferta não está disponível'}><p>{detail.kind==='unavailable'?'Tente novamente em alguns instantes.':'Ela pode ter sido encerrada ou retirada do catálogo.'}</p><a className="button primary" href="#catalogo">Ver anúncios</a></Empty>)}
      {route.name==='vendedor'&&route.sellerId&&<SellerPublicProfile id={route.sellerId}/>}
      {['entrar','area','publicar'].includes(route.name)&&<SellerArea key={route.name+':'+(route.draftId||route.editId||'')} view={route.name as 'entrar'|'area'|'publicar'} draftId={route.draftId} editId={route.editId}/>}
      {route.name==='admin'&&<SellerArea admin/>}
      {route.name==='indisponivel'&&<Empty title="Página não encontrada" icon="search"><p>Continue explorando as oportunidades do bairro.</p><a href="#inicio" className="button primary">Voltar ao início</a></Empty>}
    </main>
    <footer className="footer"><div className="container footer-grid"><div><a className="brand" href="#inicio">VENDE<span>+</span></a><p>O comércio do seu bairro,<br/>com novas possibilidades.</p><span className="footer-location"><Icon name="pin"/>Poranga e Jacarezinho · Itacoatiara, AM</span></div><div><h2>VENDE+</h2><a href="#catalogo">Ver anúncios</a><a href="#area">Minha área</a><p>Um produto APOCALYPTIC.</p></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} VENDE+ · APOCALYPTIC</span><span>Negocie com atenção. Valorize o comércio local.</span></div></footer>
    <nav className="mobile-bottom" aria-label="Atalhos para celular">{[['inicio','Início e busca','home'],['publicar','Anunciar','plus'],['area','Minha área','user']].map(([name,label,icon])=><a key={name} href={`#${name}`} aria-current={route.name===name?'page':undefined}><Icon name={icon}/>{label}</a>)}</nav>
    {dialog&&<Modal title={dialog.title} onClose={()=>setDialog(null)}>{dialog.content}</Modal>}
  </div>;
}
