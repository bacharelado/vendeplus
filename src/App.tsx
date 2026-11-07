import {useEffect, useState, type FormEvent, type ReactNode} from 'react';
import {ListingCard} from './components/ListingCard';
import {categories, initialListings, type Category, type Listing, type ListingStatus} from './data/mock';
import {classifyContent, formatBRL, parseBRL} from './lib/pricing.mjs';
import {filterListings} from './lib/catalog.mjs';

type Area = 'publico'|'vendedor'|'admin';
type Page = {name: 'inicio'|'catalogo'|'anuncio'|'cadastro'|'painel'|'publicar'|'admin'; id?:number};
type Report = {id:number; listingId:number; reason:string; status:'aberta'|'resolvida'};
const parseHash = ():Page => {
  const path = window.location.hash.replace(/^#/,'') || 'inicio';
  const match = /^anuncio-(\d+)$/.exec(path);
  if (match) return {name:'anuncio',id:Number(match[1])};
  if (['inicio','catalogo','cadastro','painel','publicar','admin'].includes(path)) return {name:path as Page['name']};
  return {name:'inicio'};
};
const go = (hash:string) => {window.location.hash=hash;};
const areaOf = (page:Page):Area => page.name==='admin'?'admin':page.name==='painel'||page.name==='publicar'?'vendedor':'publico';

function Pill({children}:{children:ReactNode}) {return <span className="pill">{children}</span>}
function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}) {
  useEffect(()=>{const cb=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()};window.addEventListener('keydown',cb);return ()=>window.removeEventListener('keydown',cb)},[onClose]);
  return <div className="overlay" role="presentation" onClick={onClose}>
    <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={e=>e.stopPropagation()}>
      <div className="section-heading"><h2>{title}</h2><button className="ghost" onClick={onClose} aria-label="Fechar">✕</button></div>{children}
    </div>
  </div>;
}

export function App(){
  const [page,setPage]=useState<Page>(parseHash);
  const [listings,setListings]=useState<Listing[]>(initialListings);
  const [reports,setReports]=useState<Report[]>([]);
  const [audit,setAudit]=useState<string[]>(['Protótipo iniciado com dados fictícios.']);
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('Todas');
  const [condition,setCondition]=useState('Todas');
  const [sortOrder,setSortOrder]=useState<'recentes'|'menor'|'maior'>('recentes');
  const [dialog,setDialog]=useState<ReactNode|null>(null);
  const [dialogTitle,setDialogTitle]=useState('Informação');
  const [dark,setDark]=useState(false);
  const [blocked,setBlocked]=useState(false);
  useEffect(()=>{const cb=()=>{setPage(parseHash());window.scrollTo(0,0)};window.addEventListener('hashchange',cb);return ()=>window.removeEventListener('hashchange',cb)},[]);
  const show=(title:string,content:ReactNode)=>{setDialogTitle(title);setDialog(content)};
  const area=areaOf(page);
  const visible=listings.filter(l=>l.status==='PUBLICADO');
  const filtered=filterListings(listings,{category,condition,query,sortOrder});
  const resetFilters=()=>{setQuery('');setCategory('Todas');setCondition('Todas');setSortOrder('recentes');};
  const active=page.id?listings.find(l=>l.id===page.id):undefined;
  const mine=listings.filter(l=>l.owner&&l.status!=='REMOVIDO');
  const updateStatus=(id:number,status:ListingStatus)=>{
    setListings(current=>current.map(l=>l.id===id?{...l,status}:l));
    setAudit(a=>[...a,`Demonstração: anúncio ${id} → ${status}`]);
  };
  const report=(event:FormEvent<HTMLFormElement>,listing:Listing)=>{
    event.preventDefault();
    const data=new FormData(event.currentTarget);
    const reason=String(data.get('reason')||'Outro');
    setReports(r=>[...r,{id:Date.now(),listingId:listing.id,reason,status:'aberta'}]);
    setAudit(a=>[...a,`Denúncia simulada recebida para anúncio ${listing.id}: ${reason}`]);
    setDialog(null);
  };
  const publish=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const form=event.currentTarget;const data=new FormData(form);
    const cat=String(data.get('category')) as Category;
    const price=parseBRL(data.get('price'),cat==='Serviços');
    if(!price.ok){show('Preço inválido',<p>{price.error}</p>);return}
    if(blocked){show('Publicações suspensas',<p>Simulação de bloqueio emergencial da administração.</p>);return}
    const title=String(data.get('title')).trim(),description=String(data.get('description')).trim();
    const status=classifyContent(`${title} ${description}`) as ListingStatus;
    const entry:Listing={id:Math.max(...listings.map(l=>l.id),0)+1,title,description,category:cat,condition:String(data.get('condition')) as Listing['condition'],priceCents:price.cents,seller:'Vendedor de demonstração',emoji:categories.find(c=>c.name===cat)?.emoji??'📦',image:undefined,fulfillment:String(data.get('fulfillment')),status,owner:true,views:0,contacts:0};
    setListings(cur=>[...cur,entry]);setAudit(a=>[...a,`Anúncio ${entry.id}: ${status} (simulado)`]);
    show('Anúncio enviado',<><p>Status: <strong>{status.replace('_',' ')}</strong>.</p><p>{status==='PUBLICADO'?'O produto aparece no catálogo fictício.':'O anúncio não aparece no catálogo enquanto estiver retido.'}</p><a className="button primary" href="#painel" onClick={()=>setDialog(null)}>Ir ao painel</a></>);
  };
  const demoWhatsapp=(listing:Listing)=>show('Contato pelo WhatsApp — simulação',<><p>Em produção, este botão abrirá uma conversa com o número confirmado do vendedor.</p><p className="muted">Produto: {listing.title}</p><p>Não há contatos reais neste protótipo.</p></>);
  return <div className={dark?'app dark':'app'} data-area={area}>
    <header className="topbar"><div className="container topbar-row"><a className="brand" href="#inicio">VENDE<span>+</span></a><div className="area-label">{area==='publico'?'Poranga II · demonstração':area==='vendedor'?'ÁREA DO VENDEDOR':'ÁREA ADMINISTRATIVA'}</div><button className="theme" onClick={()=>setDark(v=>!v)} aria-label="Alternar tema">◐</button></div>
      <nav className="container nav" aria-label="Menu principal">
        {(area==='publico'?[['inicio','Início'],['catalogo','Encontrar produtos'],['cadastro','Quero anunciar']]:area==='vendedor'?[['painel','Meu painel'],['publicar','Publicar anúncio'],['inicio','← Site público']]:[['admin','Moderação'],['inicio','← Site público']]).map(([slug,label])=><a key={slug} className={page.name===slug?'selected':''} href={`#${slug}`}>{label}</a>)}
      </nav>
    </header>
    <div className="demo-banner"><span>DEMONSTRAÇÃO • dados fictícios • nada é salvo</span><div>Ver como: <a href="#inicio">Visitante</a> · <a href="#painel">Vendedor</a> · <a href="#admin">Administrador</a></div></div>
    <main className="container main">
      {page.name==='inicio'&&<><section className="hero"><div className="hero-grid"><div className="hero-copy"><div className="eyebrow">O comércio do Poranga II, em um só lugar</div><h1>Seu bairro tem de tudo. <span>Encontre aqui.</span></h1><p>Comida, roupas, celulares e serviços pertinho de você. Descubra ofertas locais e converse direto com quem anuncia.</p><form onSubmit={e=>{e.preventDefault();resetFilters();setQuery(String(new FormData(e.currentTarget).get('q')||''));go('catalogo')}} className="search"><input name="q" placeholder="O que você procura?" aria-label="Pesquisar"/><button className="button teal">Buscar</button></form><div className="hero-actions"><a className="button primary" href="#catalogo" onClick={resetFilters}>Explorar ofertas <span aria-hidden="true">↗</span></a><a className="button light" href="#cadastro">Quero anunciar <span aria-hidden="true">＋</span></a></div><div className="hero-trust">✓ Sem comissão no piloto &nbsp; · &nbsp; ✓ Negociação direta</div></div><div className="hero-visual" aria-hidden="true"><span className="hero-visual-fallback">🛍️</span><img src="https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1200&q=80" alt="" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.hidden=true}}/><div className="hero-visual-caption"><strong>VENDE+</strong><span>Uma vitrine para o seu bairro</span></div></div></div></section>
        <div className="section-heading"><h2>Explore por categoria</h2></div><div className="category-grid">{categories.map(c=><button key={c.name} className="category" onClick={()=>{resetFilters();setCategory(c.name);go('catalogo')}}><span>{c.emoji}</span>{c.name}</button>)}</div>
        <div className="section-heading"><h2>Novidades do bairro</h2><a href="#catalogo">Ver todos</a></div><div className="product-grid">{visible.slice(0,4).map(l=><ListingCard key={l.id} listing={l}/>)}</div>
        <div className="tip"><strong>Compre com atenção.</strong><p>Confira o produto antes de pagar. Prefira negociações em locais públicos. VENDE+ não intermedeia pagamentos.</p></div>
      </>}
      {page.name==='catalogo'&&<><div className="section-heading"><div><div className="eyebrow">Produtos e serviços</div><h1>Catálogo</h1></div><Pill>{filtered.length} anúncios</Pill></div>
        <div className="filters"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar produtos ou serviços..." aria-label="Buscar anúncios"/><select aria-label="Condição" value={condition} onChange={e=>setCondition(e.target.value)}><option>Todas</option><option>Novo</option><option>Usado</option><option>Não aplicável</option></select><select aria-label="Ordenação" value={sortOrder} onChange={e=>setSortOrder(e.target.value as typeof sortOrder)}><option value="recentes">Mais recentes</option><option value="menor">Menor preço</option><option value="maior">Maior preço</option></select></div>
        <div className="chips"><button className={category==='Todas'?'selected':''} onClick={()=>setCategory('Todas')}>Todas</button>{categories.map(c=><button className={category===c.name?'selected':''} onClick={()=>setCategory(c.name)} key={c.name}>{c.name}</button>)}</div>
        <div className="filter-feedback"><span>{filtered.length} resultado(s) nesta busca</span><button type="button" onClick={resetFilters}>Limpar filtros</button></div><div className="product-grid">{filtered.map(l=><ListingCard listing={l} key={l.id}/>)}</div>{!filtered.length&&<div className="empty"><h2>Nada por aqui ainda</h2><p>Tente outra palavra ou categoria.</p><button className="button primary" onClick={resetFilters}>Ver todos os anúncios</button></div>}
      </>}
      {page.name==='anuncio'&&(active&&active.status==='PUBLICADO'?<><a className="back" href="#catalogo">← Voltar ao catálogo</a><div className="detail"><div className="detail-image" aria-label="Foto ilustrativa da categoria do produto"><span className="photo-fallback">{active.emoji}</span>{active.image&&<img src={active.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.hidden=true}}/>}<span className="listing-image-label">Imagem ilustrativa</span></div><div><Pill>{active.condition}</Pill><h1>{active.title}</h1><div className="big-price">{formatBRL(active.priceCents)}</div><p className="muted">{active.category} · {active.views} visualizações fictícias</p><button className="button teal full" onClick={()=>demoWhatsapp(active)}>💬 Conversar pelo WhatsApp</button><h3>Descrição</h3><p>{active.description}</p><div className="panel"><strong>Vendedor</strong><p>{active.seller}</p><p className="muted">Poranga II (vínculo declarado, não verificado)</p><strong>Atendimento</strong><p>{active.fulfillment}</p></div><div className="tip"><strong>Segurança</strong><p>Não pague adiantado a desconhecidos. Confira o anúncio e negocie com cautela.</p></div><div className="actions"><button className="button outline" onClick={()=>show('Link compartilhável',<><p>Este endereço pode ser usado para compartilhar o anúncio fictício:</p><code>{window.location.href}</code></>)}>🔗 Compartilhar</button><button className="button outline" onClick={()=>show('Denunciar anúncio',<form onSubmit={e=>report(e,active)}><label>Motivo<select name="reason"><option>Suspeita de golpe</option><option>Item proibido</option><option>Informação falsa</option><option>Outro</option></select></label><button className="button primary">Enviar denúncia (simulação)</button></form>)}>🚩 Denunciar</button></div></div></div></>:<div className="empty"><h1>Anúncio indisponível</h1><p>Este anúncio não existe ou está fora do ar.</p><a href="#catalogo" className="button primary">Ver catálogo</a></div>)}
      {page.name==='cadastro'&&<section className="narrow"><div className="eyebrow">Quero anunciar</div><h1>Cadastro do vendedor</h1><p className="muted">Esta tela ainda é demonstrativa. Use apenas dados inventados: nada é enviado ou armazenado.</p><form className="panel form" onSubmit={e=>{e.preventDefault();show('Cadastro simulado',<p>Na próxima fase, vamos implementar autenticação real e confirmação manual do WhatsApp.</p>)}}><label>Nome de exibição<input required minLength={2} placeholder="Ex.: Maria S."/></label><label>E-mail<input type="email" required placeholder="voce@exemplo.com"/></label><label>WhatsApp comercial<input required type="tel" placeholder="(92) 90000-0000"/></label><label>Tipo de anunciante<select><option>Morador</option><option>Empresa ou comerciante</option><option>Prestador de serviços</option></select></label><label className="check"><input type="checkbox" required/> Declaro ter vínculo com o Poranga II.</label><label className="check"><input type="checkbox" required/> Tenho 18 anos ou mais.</label><label className="check"><input type="checkbox" required/> Aceito os termos (ainda não publicados).</label><button className="button primary full">Criar conta de demonstração</button></form></section>}
      {page.name==='publicar'&&<section className="narrow"><div className="eyebrow">Área do vendedor</div><h1>Publicar anúncio</h1><p className="muted">Use apenas informações fictícias. Este formulário é uma demonstração e não salva dados ao recarregar.</p><form className="panel form" onSubmit={publish}><label>Título<input name="title" minLength={5} maxLength={90} required placeholder="Ex.: Bicicleta aro 26"/></label><label>Categoria<select name="category">{categories.map(c=><option key={c.name}>{c.name}</option>)}</select></label><label>Preço em reais<input name="price" inputMode="decimal" placeholder="Ex.: 25,90; serviços podem ficar sob orçamento"/></label><label>Condição<select name="condition"><option>Novo</option><option>Usado</option><option>Não aplicável</option></select></label><label>Descrição<textarea name="description" minLength={10} maxLength={2000} required placeholder="Detalhe o produto..."/></label><label>Atendimento ou entrega<input name="fulfillment" required placeholder="Ex.: Retirada no bairro"/></label><div className="photo-demo">📷 Imagens serão implementadas e validadas na fase de back-end.</div><button className="button primary full">Publicar (simulação)</button></form></section>}
      {page.name==='painel'&&<><div className="section-heading"><div><div className="eyebrow">Vendedor fictício</div><h1>Meu painel</h1></div><a href="#publicar" className="button primary">+ Anunciar</a></div><div className="stats"><div><strong>{mine.filter(l=>l.status==='PUBLICADO').length}</strong><small>Publicados</small></div><div><strong>{mine.reduce((acc,l)=>acc+l.views,0)}</strong><small>Visualizações*</small></div><div><strong>{mine.reduce((acc,l)=>acc+l.contacts,0)}</strong><small>Cliques*</small></div></div><small className="muted">* Indicadores fictícios. Cliques não são vendas.</small>
        <div className="stack">{mine.map(l=><div key={l.id} className="panel listing-line"><span className="tile">{l.emoji}</span><div className="listing-line-body"><strong>{l.title}</strong><div className="muted">{formatBRL(l.priceCents)} · {l.status}</div></div><div className="actions">{l.status==='PUBLICADO'?<button className="button outline" onClick={()=>updateStatus(l.id,'PAUSADO')}>Pausar</button>:l.status==='PAUSADO'?<button className="button outline" onClick={()=>updateStatus(l.id,'PUBLICADO')}>Reativar</button>:null}{l.status==='PUBLICADO'&&<button className="button outline" onClick={()=>updateStatus(l.id,'VENDIDO')}>Vendido</button>}</div></div>)}</div>
      </>}
      {page.name==='admin'&&<><div className="eyebrow">Área administrativa simulada</div><h1>Moderação e denúncias</h1><div className="tip"><strong>Não existe autenticação real neste projeto.</strong><p>O acesso livre a esta tela serve apenas à demonstração; o sistema final terá autenticação, MFA e autorização no servidor.</p></div><div className="panel admin-switch"><span>Bloqueio emergencial de publicações (simulado): <strong>{blocked?'Ligado':'Desligado'}</strong></span><button className="button outline" onClick={()=>setBlocked(v=>!v)}>{blocked?'Desligar':'Ligar'}</button></div><h2>Fila de denúncias</h2>{reports.length===0?<div className="empty">Nenhuma denúncia enviada nesta sessão. Teste o botão Denunciar em um anúncio.</div>:<div className="stack">{reports.map(r=><div className="panel listing-line" key={r.id}><div className="listing-line-body"><strong>Anúncio #{r.listingId}</strong><p>{r.reason}</p><Pill>{r.status}</Pill></div><button className="button outline" onClick={()=>{setReports(all=>all.map(x=>x.id===r.id?{...x,status:'resolvida'}:x));setAudit(a=>[...a,`Denúncia #${r.id} marcada como resolvida`])}}>Resolver</button></div>)}</div>}<h2>Auditoria simulada</h2><div className="panel audit">{audit.slice().reverse().map((a,i)=><div key={i}>{a}</div>)}</div></>}
    </main>
    <nav className="mobile-bottom" aria-label="Atalhos para celular"><a href="#inicio" aria-current={page.name==='inicio'?'page':undefined}><span aria-hidden="true">🏠</span>Início</a><a href="#catalogo" aria-current={page.name==='catalogo'||page.name==='anuncio'?'page':undefined}><span aria-hidden="true">🔎</span>Buscar</a><a href="#cadastro" aria-current={page.name==='cadastro'?'page':undefined}><span aria-hidden="true">➕</span>Anunciar</a><a href="#painel" aria-current={page.name==='painel'||page.name==='publicar'?'page':undefined}><span aria-hidden="true">🛍️</span>Vendedor</a></nav>
    <footer className="footer"><div className="container"><strong>VENDE<span>+</span></strong><p>Piloto Poranga II, Itacoatiara-AM • Produto APOCALYPTIC • Demo, não publicado comercialmente.</p></div></footer>
    {dialog!==null&&<Modal title={dialogTitle} onClose={()=>setDialog(null)}>{dialog}</Modal>}
  </div>;
}
