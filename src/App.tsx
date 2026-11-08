import {useEffect,useRef,useState,type FormEvent,type ReactNode} from 'react';
import {categories,type Category,type Condition,type Draft,type Listing} from './data/marketplace';
import {SellerArea} from './components/SellerArea';
import {PhotoPicker} from './components/PhotoAssistant';
import {ListingCard} from './components/ListingCard';
import {SellerPublicProfile} from './components/SellerPublicProfile';
import {ReportListing} from './components/ReportListing';
import {Icon} from './components/Icon';
import {filterListings} from './lib/catalog.mjs';
import {formatBRL,parseBRL} from './lib/pricing.mjs';
import {createDraftId,readDrafts,writeDrafts} from './lib/drafts.mjs';
import {fetchCatalogPage,fetchListing,type CatalogState} from './lib/api';

type Route={name:string;id?:number;draftId?:string;sellerId?:string};
function readRoute():Route{
  const hash=location.hash.slice(1)||'inicio';
  const listing=/^anuncio-(\d+)$/.exec(hash);
  if(listing)return {name:'anuncio',id:Number(listing[1])};
  const edit=/^editar-([a-zA-Z0-9-]+)$/.exec(hash);
  if(edit)return {name:'publicar',draftId:edit[1]};
  const seller=/^vendedor-([a-f0-9-]{36})$/.exec(hash);
  if(seller)return {name:'vendedor',sellerId:seller[1]};
  if(hash==='cadastro')return {name:'conta'};
  return {name:['inicio','catalogo','painel','publicar','anunciar','admin','conta','como-funciona'].includes(hash)?hash:'indisponivel'};
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
function DraftForm({initial,onSave}:{initial?:Draft;onSave:(draft:Draft,photo:File|null)=>void}){
  const [photoFile,setPhotoFile]=useState<File|null>(null);
  const [category,setCategory]=useState<Category>(initial?.category||'Alimentação');
  const [error,setError]=useState('');
  const submit=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setError('');
    const form=new FormData(event.currentTarget);
    const title=String(form.get('title')||'').trim();
    const description=String(form.get('description')||'').trim();
    const fulfillment=String(form.get('fulfillment')||'').trim();
    const price=parseBRL(form.get('price'),category==='Serviços');
    if(title.length<5||description.length<10||!fulfillment){setError('Preencha título, descrição e atendimento. Espaços em branco não contam.');return}
    if(!price.ok){setError(price.error);return}
    try{onSave({id:initial?.id||createDraftId(),title,description,fulfillment,category,condition:String(form.get('condition')) as Condition,priceCents:price.cents,updatedAt:Date.now()},photoFile)}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível salvar o rascunho.')}
  };
  return <form className="draft-form panel" onSubmit={submit}>
    <PhotoPicker draftMode onFile={setPhotoFile}/>
    <div className="form-heading"><span className="step-number">1</span><div><h2>Conte sobre o que você oferece</h2><p>Informações claras ajudam as pessoas a escolher.</p></div></div>
    <label>O que você está vendendo?<input name="title" required minLength={5} maxLength={90} defaultValue={initial?.title} placeholder="Ex.: Mesa de madeira com 4 cadeiras"/></label>
    <div className="form-row"><label>Categoria<select name="category" value={category} onChange={e=>setCategory(e.target.value as Category)}>{categories.map(c=><option key={c.name}>{c.name}</option>)}</select></label><label>Condição<select name="condition" defaultValue={initial?.condition||'Novo'}><option>Novo</option><option>Usado</option><option>Não aplicável</option></select></label></div>
    <label>Preço em reais<input name="price" inputMode="decimal" maxLength={20} defaultValue={initial?.priceCents?((initial.priceCents/100).toFixed(2).replace('.',',')):''} placeholder="Ex.: 120,00"/><span className="field-help">{category==='Serviços'?'Deixe em branco se o serviço for sob orçamento.':'Informe o valor total do produto.'}</span></label>
    <label>Conte sobre o produto<textarea name="description" required minLength={10} maxLength={2000} defaultValue={initial?.description} placeholder="Descreva o estado, os detalhes e o que está incluído."/></label>
    <label>Como será a entrega?<input name="fulfillment" required maxLength={180} defaultValue={initial?.fulfillment} placeholder="Ex.: retirada no Poranga e Jacarezinho, em horário combinado"/></label>
    <div className="local-note"><Icon name="shield"/><p>Este rascunho fica salvo somente neste navegador. Ele ainda não será publicado nem ficará visível para outras pessoas.</p></div>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <button className="button primary full" type="submit"><Icon name="check"/>{initial?'Salvar alterações':'Salvar rascunho'}</button>
  </form>;
}
export function App(){
  const [route,setRoute]=useState(readRoute);
  const [submission,setSubmission]=useState<Draft>();
  const draftPhotoRef=useRef(new Map<string,File>());
  const [submissionPhoto,setSubmissionPhoto]=useState<File|null>(null);
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
  const [drafts,setDrafts]=useState<Draft[]>(()=>{try{return readDrafts(localStorage)}catch{return []}});
  const [dark,setDark]=useState(()=>{try{return localStorage.getItem('vendeplus:theme')==='dark'}catch{return false}});
  const [notice,setNotice]=useState('');
  const [dialog,setDialog]=useState<{title:string;content:ReactNode}|null>(null);
  const mainRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    const onHash=()=>{setDialog(null);setNotice('');setRoute(readRoute());window.scrollTo(0,0);requestAnimationFrame(()=>mainRef.current?.focus({preventScroll:true}))};
    window.addEventListener('hashchange',onHash);return ()=>window.removeEventListener('hashchange',onHash);
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    const timer=window.setTimeout(()=>controller.abort(),8000);
    catalogVersion.current++;setNextCursor(undefined);
    setCatalog({kind:'loading',listings:[]});
    let disposed=false;
    fetchCatalogPage(controller.signal).then(page=>{if(!disposed){setCatalog({kind:'ready',listings:page.listings});setNextCursor(page.nextCursor)}}).catch(()=>{if(!disposed)setCatalog({kind:'unavailable',listings:[]})}).finally(()=>clearTimeout(timer));
    return ()=>{disposed=true;controller.abort();clearTimeout(timer)};
  },[refresh]);
  useEffect(()=>{const update=(event:StorageEvent)=>{if(event.key==='vendeplus:drafts:v1'||event.key===null){try{setDrafts(readDrafts(localStorage))}catch{}}};window.addEventListener('storage',update);return ()=>window.removeEventListener('storage',update)},[]);
  useEffect(()=>{const titles:Record<string,string>={inicio:'Compre e venda no Poranga e Jacarezinho',catalogo:'Encontre no bairro',anunciar:'Publicar anúncio',publicar:'Prepare seu anúncio',painel:'Meus rascunhos',conta:'Minha conta',admin:'Administração',anuncio:'Detalhes do anúncio',vendedor:'Perfil do vendedor','como-funciona':'Como funciona'};document.title=`${titles[route.name]||'VENDE+'} | VENDE+`},[route.name]);
  const changeTheme=()=>{setDark(current=>{try{localStorage.setItem('vendeplus:theme',current?'light':'dark')}catch{}return !current})};
  const reset=()=>{setQuery('');setCategory('Todas');setCondition('Todas');setNeighborhood('Todos');setOrder('recentes')};
  const browse=(nextCategory='Todas')=>{reset();setCategory(nextCategory);location.hash='catalogo'};
  const filtered=filterListings(catalog.listings,{query,category,condition,neighborhood,sortOrder:order});
  const active=detail.id===route.id&&detail.kind==='ready'?detail.listing:undefined;
  useEffect(()=>{
    if(route.name!=='anuncio'||!route.id)return;
    const id=route.id,controller=new AbortController();let disposed=false;
    setDetail({id,kind:'loading'});
    fetchListing(id,controller.signal).then(listing=>{if(!disposed)setDetail({id,kind:'ready',listing})}).catch(()=>{if(!disposed)setDetail({id,kind:'unavailable'})});
    return ()=>{disposed=true;controller.abort()};
  },[route.name,route.id,refresh]);
  const more=async()=>{
    if(!nextCursor||loadingMore)return;
    setLoadingMore(true);setNotice('');const version=catalogVersion.current;
    try{const page=await fetchCatalogPage(AbortSignal.timeout(8000),nextCursor);if(version!==catalogVersion.current)return;setCatalog(current=>current.kind==='ready'?{kind:'ready',listings:[...new Map([...current.listings,...page.listings].map(item=>[item.id,item])).values()]}:current);setNextCursor(page.nextCursor)}
    catch{setNotice('Não foi possível carregar mais anúncios. Tente novamente.')}finally{setLoadingMore(false)}
  };
  const save=(draft:Draft,photo:File|null)=>{
    if(photo)draftPhotoRef.current.set(draft.id,photo);
    const next=[draft,...readDrafts(localStorage).filter(item=>item.id!==draft.id)];
    writeDrafts(localStorage,next);setDrafts(next);location.hash='painel';
  };
  const remove=(id:string)=>{
    draftPhotoRef.current.delete(id);
    try{const next=readDrafts(localStorage).filter(item=>item.id!==id);writeDrafts(localStorage,next);setDrafts(next);setDialog(null);setNotice('Rascunho excluído deste navegador.')}catch(reason){setDialog(null);setNotice(reason instanceof Error?reason.message:'Não foi possível excluir.')}
  };
  const share=async(listing:Listing)=>{
    const link=location.origin+location.pathname+'#anuncio-'+listing.id;
    let copied=false;try{await navigator.clipboard.writeText(link);copied=true}catch{}
    setDialog({title:copied?'Link copiado':'Compartilhar anúncio',content:<><p>{copied?'Envie o endereço para quem pode se interessar.':'Selecione o endereço abaixo para copiar e enviar.'}</p><label className="share-label">Link do anúncio<input readOnly value={link} onFocus={e=>e.currentTarget.select()}/></label></>});
  };
  useEffect(()=>{if(['inicio','catalogo','anuncio'].includes(route.name))setRefresh(value=>value+1)},[route.name,route.id]);
  useEffect(()=>{const reload=()=>{if(document.visibilityState==='visible')setRefresh(value=>value+1)};document.addEventListener('visibilitychange',reload);return ()=>document.removeEventListener('visibilitychange',reload)},[]);
  const catalogContent=()=>catalog.kind==='loading'?<div className="catalog-loading" role="status"><span className="spinner"/>Buscando ofertas no bairro…</div>:catalog.kind==='unavailable'?<Empty title="Não foi possível carregar os anúncios"><p>Tente novamente. Você também pode preparar um anúncio enquanto isso.</p><div className="empty-actions"><button className="button outline" onClick={()=>setRefresh(v=>v+1)}>Tentar novamente</button><a className="button primary" href="#publicar">Preparar anúncio<Icon name="arrow"/></a></div></Empty>:filtered.length?<div className="product-grid">{filtered.map(item=><ListingCard key={item.id} listing={item}/>)}</div>:<Empty title={catalog.listings.length?'Nenhuma oferta encontrada':'O bairro tem muito a oferecer'} icon="search"><p>{catalog.listings.length?'Experimente outra palavra ou ajuste os filtros.':'As primeiras ofertas aparecerão aqui quando estiverem disponíveis.'}</p>{catalog.listings.length?<button className="button outline" onClick={reset}>Limpar filtros</button>:<a href="#publicar" className="button primary">Preparar meu anúncio<Icon name="plus"/></a>}</Empty>;
  return <div className={dark?'app dark':'app'}>
    <a href="#conteudo" className="skip-link" onClick={e=>{e.preventDefault();mainRef.current?.focus()}}>Pular para o conteúdo</a>
    <div className="location-strip"><div className="container"><span><Icon name="pin"/>Feito para Poranga e Jacarezinho, Itacoatiara</span><a href="#como-funciona">Como funciona<Icon name="arrow"/></a></div></div>
    <header className="topbar"><div className="container header-row"><a className="brand" href="#inicio" aria-label="VENDE+ início">VENDE<span>+</span></a><nav aria-label="Menu principal"><a href="#catalogo" aria-current={route.name==='catalogo'?'page':undefined}>Ver anúncios</a><a href="#conta">Minha conta</a><a href="#painel" aria-current={route.name==='painel'?'page':undefined}>Meus rascunhos</a></nav><button className="icon-button theme" onClick={changeTheme} aria-label="Alternar tema" aria-pressed={dark}><Icon name="sun"/></button><a href="#anunciar" className="button primary header-cta"><Icon name="plus"/>Anunciar</a></div></header>
    <main ref={mainRef} id="conteudo" tabIndex={-1} className="container main">
      {notice&&<div className="notice" role="status">{notice}<button className="icon-button" onClick={()=>setNotice('')} aria-label="Fechar aviso"><Icon name="close"/></button></div>}
      {route.name==='inicio'&&<>
        <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="live-dot"/>Seu bairro. Suas oportunidades.</div><h1>O que você procura<br/>pode estar <em>bem perto.</em></h1><p>Produtos, serviços e boas oportunidades de Poranga e Jacarezinho. Um lugar para encontrar, anunciar e valorizar quem está por aqui.</p><form className="search" onSubmit={e=>{e.preventDefault();const value=String(new FormData(e.currentTarget).get('q')||'');reset();setQuery(value);location.hash='catalogo'}}><Icon name="search"/><input name="q" aria-label="Pesquisar no bairro" placeholder="O que você está procurando?"/><button className="button primary">Buscar<Icon name="arrow"/></button></form><div className="hero-actions"><a href="#anunciar" className="text-link">Quero anunciar<Icon name="arrow"/></a><span><Icon name="pin"/>Poranga e Jacarezinho · Itacoatiara, AM</span></div></div><div className="hero-art" aria-hidden="true"><div className="art-ring"/><div className="art-card card-one"><span>PERTO DE VOCÊ</span><strong>Mais bairro.<br/>Mais possibilidades.</strong><Icon name="bag"/></div><div className="art-card card-two"><Icon name="pin"/><span>Poranga e Jacarezinho</span></div><div className="art-card card-three"><Icon name="check"/><span>Comércio local em movimento</span></div></div></section>
        <section className="category-section"><div className="section-heading"><div><span className="eyebrow">Encontre do seu jeito</span><h2>O que faz parte do seu dia?</h2></div><a href="#catalogo" className="text-link" onClick={reset}>Ver categorias<Icon name="arrow"/></a></div><div className="category-grid">{categories.map(item=><button className="category" key={item.name} onClick={()=>browse(item.name)}><span aria-hidden="true">{item.emoji}</span><strong>{item.name}</strong><Icon name="arrow"/></button>)}</div></section>
        <section><div className="section-heading"><div><span className="eyebrow">Descubra no bairro</span><h2>Encontre sua próxima oportunidade</h2></div><a href="#catalogo" className="text-link" onClick={reset}>Explorar<Icon name="arrow"/></a></div>{catalog.kind==='ready'&&catalog.listings.length?<div className="product-grid">{filterListings(catalog.listings).slice(0,4).map(item=><ListingCard key={item.id} listing={item}/>)}</div>:catalogContent()}</section>
        <section className="seller-callout"><div><span className="eyebrow">Tem algo para oferecer?</span><h2>Dê uma nova vitrine<br/>ao que você faz.</h2><p>Organize seu produto ou serviço em um anúncio claro, com preço, descrição e forma de atendimento.</p></div><a className="button primary" href="#anunciar">Anunciar<Icon name="plus"/></a></section>
        <section className="trust-grid"><div><Icon name="pin"/><h3>Mais perto de você</h3><p>Uma vitrine voltada ao comércio de Poranga e Jacarezinho.</p></div><div><Icon name="bag"/><h3>Produtos e serviços</h3><p>Encontre o que precisa para a rotina do bairro.</p></div><div><Icon name="shield"/><h3>Escolha com atenção</h3><p>Confira o item e as condições antes de negociar.</p></div></section>
      </>}
      {route.name==='catalogo'&&<><div className="page-heading"><div><span className="eyebrow">Explore o Poranga e Jacarezinho</span><h1>Encontre no bairro.</h1><p>Escolha uma categoria ou procure pelo que você precisa.</p></div>{catalog.kind==='ready'&&<span className="count" role="status">{filtered.length} {filtered.length===1?'oferta':'ofertas'}</span>}</div><div className="catalog-layout"><aside className="catalog-sidebar panel"><h2>Categorias</h2><button aria-pressed={category==='Todas'} onClick={()=>setCategory('Todas')}>Todas as categorias</button>{categories.map(item=><button key={item.name} aria-pressed={category===item.name} onClick={()=>setCategory(item.name)}><span aria-hidden="true">{item.emoji}</span>{item.name}</button>)}</aside><div className="catalog-results"><div className="filters"><label className="catalog-search"><Icon name="search"/><input value={query} onChange={e=>setQuery(e.target.value)} aria-label="Buscar anúncios" placeholder="Busque no bairro"/></label><select aria-label="Bairro" value={neighborhood} onChange={e=>setNeighborhood(e.target.value)}><option>Todos</option><option>Poranga I</option><option>Poranga II</option><option>Jacarezinho</option></select><select aria-label="Condição" value={condition} onChange={e=>setCondition(e.target.value)}><option>Todas</option><option>Novo</option><option>Usado</option><option>Não aplicável</option></select><select aria-label="Ordenação" value={order} onChange={e=>setOrder(e.target.value as typeof order)}><option value="recentes">Mais recentes</option><option value="menor">Menor preço</option><option value="maior">Maior preço</option></select></div>{(query||category!=='Todas'||condition!=='Todas'||neighborhood!=='Todos')&&<div className="filter-feedback"><span>{category==='Todas'?'Todas as categorias':category}</span><button onClick={reset}>Limpar filtros</button></div>}{catalogContent()}{nextCursor&&catalog.kind==='ready'&&<p className="field-help">Os filtros mostram os anúncios carregados. Toque abaixo para ver mais.</p>}{nextCursor&&catalog.kind==='ready'&&<button className="button outline full" disabled={loadingMore} onClick={()=>void more()}>{loadingMore?'Carregando…':'Ver mais anúncios'}</button>}</div></div></>}
      {route.name==='publicar'&&<><div className="account-notice">Já quer enviar seu anúncio? <a href="#conta">Entre na sua conta</a> para publicar.</div><div className="page-heading"><a href="#painel" className="back"><Icon name="arrow"/>Meus rascunhos</a><span className="eyebrow">Sua próxima oportunidade</span><h1>{route.draftId?'Edite seu rascunho.':'Prepare seu anúncio.'}</h1><p>Comece com as informações que fazem a diferença.</p></div>{route.draftId&&!drafts.some(d=>d.id===route.draftId)?<Empty title="Rascunho não encontrado"><p>Este rascunho não está salvo neste navegador.</p><a href="#painel" className="button outline">Voltar aos rascunhos</a></Empty>:<div className="editor-layout"><DraftForm key={route.draftId||'novo'} initial={drafts.find(d=>d.id===route.draftId)} onSave={save}/><aside className="editor-aside"><div className="panel"><span className="tip-label">UM BOM ANÚNCIO COMEÇA AQUI</span><h2>Pequenos detalhes.<br/>Mais clareza.</h2><ul><li>Use um título direto e fácil de encontrar.</li><li>Descreva o estado e os detalhes do item.</li><li>Informe o preço e como será a entrega.</li><li>Evite dados pessoais na descrição.</li></ul></div><div className="availability-note"><Icon name="shield"/><div><h3>Antes de publicar</h3><p>Salve o rascunho e escolha Publicar anúncio, ou entre na sua conta para cadastrar o anúncio diretamente. Anúncios comuns aparecem após a publicação. Alguns precisam de conferência antes de aparecer.</p></div></div></aside></div>}</>}
      {route.name==='painel'&&<><div className="page-heading heading-actions"><div><span className="eyebrow">Sua área</span><h1>Meus rascunhos.</h1><p>Seus anúncios em preparação, salvos neste navegador.</p></div><a href="#publicar" className="button primary"><Icon name="plus"/>Novo rascunho</a></div>{drafts.length?<div className="draft-stack">{drafts.map(draft=><article className="draft-card panel" key={draft.id}><span className="draft-symbol" aria-hidden="true">{categories.find(c=>c.name===draft.category)?.emoji}</span><div className="draft-info"><span className="draft-status">Ainda não publicado</span><h2>{draft.title}</h2><p>{formatBRL(draft.priceCents)} · {draft.category}</p><small>Atualizado em {new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(draft.updatedAt)}</small></div><div className="draft-actions"><button className="button primary" onClick={()=>{setSubmission(draft);setSubmissionPhoto(draftPhotoRef.current.get(draft.id)||null);location.hash='conta'}}>Publicar anúncio</button><a className="button outline" href={`#editar-${draft.id}`}><Icon name="edit"/>Editar</a><button className="icon-button" aria-label={`Excluir rascunho: ${draft.title}`} onClick={()=>setDialog({title:'Excluir rascunho?',content:<><p>O rascunho “{draft.title}” será excluído deste navegador.</p><div className="dialog-actions"><button className="button outline" onClick={()=>setDialog(null)}>Cancelar</button><button className="button danger" onClick={()=>remove(draft.id)}>Excluir rascunho</button></div></>})}><Icon name="trash"/></button></div></article>)}</div>:<Empty title="Sua próxima oportunidade começa aqui"><p>Prepare um anúncio para o seu produto ou serviço. Você pode voltar e editar os detalhes depois.</p><a className="button primary" href="#publicar">Criar meu primeiro rascunho<Icon name="plus"/></a></Empty>}<p className="storage-disclosure"><Icon name="shield"/>Os rascunhos não são anúncios públicos. Limpar os dados do navegador também apaga os rascunhos.</p></>}
      {route.name==='anuncio'&&(active?<><a href="#catalogo" className="back"><Icon name="arrow"/>Voltar às ofertas</a><div className="detail"><div className="detail-media"><span aria-hidden="true">{categories.find(c=>c.name===active.category)?.emoji}</span>{active.image&&<img src={active.image} alt={active.title} referrerPolicy="no-referrer" onError={e=>{e.currentTarget.hidden=true}}/>}</div><div className="detail-copy"><span className="eyebrow">{active.category} · {active.condition}</span><h1>{active.title}</h1><strong className="big-price">{formatBRL(active.priceCents)}</strong><span className="detail-location"><Icon name="pin"/>Poranga e Jacarezinho, Itacoatiara</span><div className="seller-box"><span className="seller-avatar"><Icon name="user"/></span><div><small>Anunciado por</small><a className="text-link" href={active.sellerId?'#vendedor-'+active.sellerId:'#catalogo'}><strong>{active.seller}</strong></a></div></div>{active.contactWhatsapp?<a href={`https://wa.me/${active.contactWhatsapp}?text=${encodeURIComponent('Olá! Tenho interesse no anúncio '+active.title+' que vi no VENDE+.')}`} target="_blank" rel="noopener noreferrer" className="button primary full">Conversar no WhatsApp<Icon name="arrow"/></a>:<p className="contact-unavailable">Contato do anunciante indisponível no momento.</p>}<button className="button outline full" onClick={()=>void share(active)}>Compartilhar anúncio</button><ReportListing listingId={active.id}/><h2>Sobre esta oferta</h2><p className="description">{active.description}</p><h2>Como será a entrega?</h2><p>{active.fulfillment}</p><div className="safety-note"><Icon name="shield"/><p>Confira o produto e combine as condições diretamente com quem anuncia. O VENDE+ não recebe nem intermedeia pagamentos.</p></div></div></div></>:detail.id!==route.id||detail.kind==='loading'?<div role="status" className="catalog-loading">Carregando anúncio…</div>:<Empty title={detail.kind==='unavailable'?'Não foi possível carregar esta oferta':'Esta oferta não está disponível'}><p>{detail.kind==='unavailable'?'Tente novamente em alguns instantes.':'Ela pode ter sido encerrada ou retirada do catálogo.'}</p><a className="button primary" href="#catalogo">Ver anúncios</a></Empty>)}
      {route.name==='como-funciona'&&<><div className="page-heading"><span className="eyebrow">Comércio local, mais perto</span><h1>Como funciona o VENDE+.</h1><p>Uma vitrine para os produtos e serviços de Poranga e Jacarezinho.</p></div><div className="how-grid"><article className="panel"><span className="step-number">1</span><h2>Encontre uma oferta</h2><p>Explore as categorias e leia os detalhes dos anúncios disponíveis.</p></article><article className="panel"><span className="step-number">2</span><h2>Converse com o anunciante</h2><p>Quando houver contato disponível, use o WhatsApp para tirar dúvidas e combinar as condições.</p></article><article className="panel"><span className="step-number">3</span><h2>Confira antes de negociar</h2><p>Verifique o item e prefira um local público para o encontro. Os pagamentos são combinados diretamente entre as partes.</p></article></div><section className="panel how-seller"><h2>Quer anunciar?</h2><p>Crie sua conta para publicar, editar e acompanhar seus anúncios. Você também pode salvar rascunhos neste navegador antes de enviar.</p><a href="#cadastro" className="button primary">Criar minha conta<Icon name="arrow"/></a></section></>}
      {route.name==='vendedor'&&route.sellerId&&<SellerPublicProfile id={route.sellerId}/>}
      {route.name==='anunciar'&&<SellerArea key="novo-anuncio" startNew/>}
      {route.name==='conta'&&<SellerArea key={submission?.id||'conta'} draft={submission} initialPhoto={submissionPhoto}/>}
      {route.name==='admin'&&<SellerArea admin/>}
      {route.name==='indisponivel'&&<Empty title="Página não encontrada" icon="search"><p>Continue explorando as oportunidades do bairro.</p><a href="#inicio" className="button primary">Voltar ao início</a></Empty>}
    </main>
    <footer className="footer"><div className="container footer-grid"><div><a className="brand" href="#inicio">VENDE<span>+</span></a><p>O comércio do seu bairro,<br/>com novas possibilidades.</p><span className="footer-location"><Icon name="pin"/>Poranga e Jacarezinho · Itacoatiara, AM</span></div><div><h2>Explore</h2><a href="#catalogo">Ofertas do bairro</a><a href="#publicar">Preparar anúncio</a><a href="#painel">Meus rascunhos</a></div><div><h2>VENDE+</h2><a href="#como-funciona">Como funciona</a><p>Um produto APOCALYPTIC.<br/>Feito para aproximar o bairro.</p></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} VENDE+ · APOCALYPTIC</span><span>Negocie com atenção. Valorize o comércio local.</span></div></footer>
    <nav className="mobile-bottom" aria-label="Atalhos para celular">{[['inicio','Início','home'],['catalogo','Buscar','search'],['anunciar','Anunciar','plus'],['conta','Minha área','user']].map(([name,label,icon])=><a key={name} href={`#${name}`} aria-current={route.name===name?'page':undefined}><Icon name={icon}/>{label}</a>)}</nav>
    {dialog&&<Modal title={dialog.title} onClose={()=>setDialog(null)}>{dialog.content}</Modal>}
  </div>;
}
