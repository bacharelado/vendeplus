import {useEffect,useState,type FormEvent} from 'react';
import {PhotoPicker} from './PhotoAssistant';
import {categories,type Draft} from '../data/marketplace';
import {formatBRL,parseBRL} from '../lib/pricing.mjs';
import {normalizeWhatsapp} from '../lib/phone.mjs';
import {createDraftId} from '../lib/drafts.mjs';
import {listingNotice} from '../lib/listing-notice.mjs';

type Account={id:string;name:string;email:string;neighborhood:string;role:'seller'|'admin';status:string};
type Offer={id:number;title:string;description:string;priceCents:number|null;status:string;fulfillment:string;category:string;condition:string;neighborhood?:string;seller?:string;whatsapp?:string;sellerStatus?:string};
type Report={id:number;listingId:number;reason:string;details:string;title:string;listingStatus:string;createdAt:number;sellerId?:string};
type Stats={sellers:number;published:number;reports:number;listings:number};
type AdminSeller={id:string;name:string;email:string;neighborhood:string;role:string;status:string};
type AdminListing={id:number;title:string;status:string;seller:string};
const statuses:Record<string,string>={pending:'Em verificação',published:'Publicado',paused:'Pausado',sold:'Vendido',rejected:'Não aprovado',removed:'Removido'};
async function api(path:string,method='GET',data?:unknown){
 const response=await fetch('/api/account/'+path,{method,credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',...(data===undefined?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(20000)});
 let value;try{value=await response.json()}catch{throw new Error('Não foi possível acessar o servidor.')}
 if(!response.ok)throw new Error(typeof value.error==='string'?value.error:'Não foi possível concluir a solicitação.');
 return value;
}
async function preparePhoto(file:File):Promise<Blob>{
 if(!file.type.startsWith('image/')||file.size>12000000)throw new Error('Selecione uma foto de até 12 MB.');
 const bitmap=await createImageBitmap(file);
 const ratio=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Não foi possível processar a foto.');
 ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 for(let attempt=0;attempt<4;attempt++){
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Foto inválida.')),'image/png'));
  if(blob.size<=3145728)return blob;
  const smaller=document.createElement('canvas');smaller.width=Math.max(1,Math.floor(canvas.width*0.75));smaller.height=Math.max(1,Math.floor(canvas.height*0.75));
  const context=smaller.getContext('2d');if(!context)break;context.drawImage(canvas,0,0,smaller.width,smaller.height);canvas.width=smaller.width;canvas.height=smaller.height;ctx.drawImage(smaller,0,0);
 }
 throw new Error('Foto muito grande. Escolha uma imagem menor.');
}
export function SellerArea({draft,admin=false,initialPhoto=null,startNew=false}:{draft?:Draft;admin?:boolean;initialPhoto?:File|null;startNew?:boolean}){
 const [selectedPhoto,setSelectedPhoto]=useState<File|null>(initialPhoto);
 const [photoAvailable,setPhotoAvailable]=useState<boolean>();
 useEffect(()=>{let active=true;fetch('/api/media-upload',{cache:'no-store',signal:AbortSignal.timeout(8000)}).then(async response=>{const value=await response.json();if(active)setPhotoAvailable(response.ok&&value.available===true)}).catch(()=>{if(active)setPhotoAvailable(false)});return ()=>{active=false}},[]);
 const [account,setAccount]=useState<Account|null>(null),[loading,setLoading]=useState(true),[register,setRegister]=useState(location.hash==='#cadastro');
 const [offers,setOffers]=useState<Offer[]>([]),[reports,setReports]=useState<Report[]>([]),[stats,setStats]=useState<Stats|null>(null);
 const [sellers,setSellers]=useState<AdminSeller[]>([]),[allListings,setAllListings]=useState<AdminListing[]>([]);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [category,setCategory]=useState<string>(draft?.category||'Alimentação'),[requestId,setRequestId]=useState(createDraftId),[showForm,setShowForm]=useState(!!draft||startNew),[editing,setEditing]=useState<Offer|null>(null);
 const [profileName,setProfileName]=useState(''),[bio,setBio]=useState('');
 const [readyAccount,setReadyAccount]=useState<string|null>(null);
 const refresh=async(loadProfile=false)=>{
  if(admin){
   const [pending,queue,overview,people,listingRows]=await Promise.all([api('moderation'),api('admin/reports'),api('admin/stats'),api('admin/sellers'),api('admin/listings')]);
   setOffers(pending.listings);setReports(queue.reports);setStats(overview);setSellers(people.sellers);setAllListings(listingRows.listings);
  }else{
   const [items,profile]=await Promise.all([api('listings'),loadProfile?api('profile'):Promise.resolve(null)]);
   setOffers(items.listings);if(profile){setProfileName(profile.profile.name);setBio(profile.profile.bio||'')}
  }
 };
 useEffect(()=>{let active=true;api('session').then(value=>{if(active)setAccount(value.account)}).catch(reason=>{if(active)setError(reason.message)}).finally(()=>{if(active)setLoading(false)});return ()=>{active=false}},[]);
 useEffect(()=>{if(account&&(!admin||account.role==='admin')){let active=true;setReadyAccount(null);void refresh(true).catch(reason=>{if(active)setError(reason.message)}).finally(()=>{if(active)setReadyAccount(account.id)});return ()=>{active=false}}},[account,admin]);
 const execute=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');setNotice('');try{await fn()}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível concluir a solicitação.')}finally{setBusy(false)}};
 const authenticate=(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  const form=event.currentTarget,data=Object.fromEntries(new FormData(form));
  const whatsapp=normalizeWhatsapp(data.whatsapp);
  if(register&&!whatsapp){setError('Informe um WhatsApp brasileiro com DDD.');return}
  void execute(async()=>{const value=await api(register?'register':'login','POST',{...data,...(register?{whatsapp}:{}),acceptContact:data.acceptContact==='on'});form.reset();setReadyAccount(null);setAccount(value.account);setRegister(false);setNotice(register?'Conta criada. Você já pode anunciar. Seu contato ainda não foi verificado.':'Você entrou na sua conta.')});
 };
 const submit=(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  const form=event.currentTarget,data=Object.fromEntries(new FormData(form));
  const photo=selectedPhoto;
  if(photo&&photoAvailable===undefined){setError('Aguarde um instante enquanto verificamos o envio da foto.');return}
  const price=parseBRL(data.price,category==='Serviços');if(!price.ok){setError(price.error);return}
  void execute(async()=>{
   const payload={...data,priceCents:price.cents,...(editing?{action:'edit'}:{requestId})};
   const result=await api(editing?'listings/'+editing.id:'listings',editing?'PATCH':'POST',payload);
   const id=editing?.id||Number(result.id);
   let photoNotice=photo&&photoAvailable===false?' O anúncio foi salvo sem foto porque o envio de imagens está indisponível.':'';
   if(photo&&photo.size&&photoAvailable){
    try{
     const image=await preparePhoto(photo);
     const response=await fetch('/api/media-upload?listingId='+id,{method:'POST',headers:{'Content-Type':image.type},body:image,credentials:'same-origin',signal:AbortSignal.timeout(30000)});
     const value=await response.json();
     if(!response.ok)throw new Error(value.error||'Falha na foto.');
     if(value.warning)photoNotice=' '+value.warning;
    }catch(reason){photoNotice=' A oferta foi salva, mas a foto não: '+(reason instanceof Error?reason.message:'erro de envio')+'.'}
   }
   setRequestId(createDraftId());setShowForm(false);setEditing(null);setSelectedPhoto(null);await refresh();
   setNotice(listingNotice(result.status)+photoNotice);
  });
 };
 const edit=(offer:Offer)=>{setEditing(offer);setSelectedPhoto(null);setCategory(offer.category);setShowForm(true);window.scrollTo({top:0,behavior:'smooth'})};
 const update=(offer:Offer,status:string)=>void execute(async()=>{const result=await api('listings/'+offer.id,'PATCH',{status});await refresh();setNotice(result.warning||(status==='removed'?'Anúncio removido.':'Anúncio atualizado.'))});
 const moderate=(offer:Offer,status:string)=>void execute(async()=>{await api('moderation/'+offer.id,'POST',{status});await refresh();setNotice('Decisão registrada.')});
 const reviewReport=(report:Report,decision:'dismissed'|'removed')=>{if(decision==='removed'&&!window.confirm('Retirar este anúncio do catálogo?'))return;void execute(async()=>{await api('admin/reports/'+report.id,'POST',{decision});await refresh();setNotice('Denúncia resolvida.')})};
 const saveProfile=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();void execute(async()=>{await api('profile','PATCH',{name:profileName,bio});await refresh(true);setNotice('Perfil atualizado.')})};
 if(loading||account&&(!admin||account.role==='admin')&&readyAccount!==account.id)return <div className="catalog-loading" role="status">Carregando sua conta…</div>;
 return <section className="account-area">
  <div className="page-heading"><span className="eyebrow">VENDE+ · Poranga e Jacarezinho</span><h1>{admin?'Administração do site.':account?'Meus anúncios.':register?'Crie sua conta.':'Entre na sua conta.'}</h1><p>{account?'Olá, '+account.name+'.':'Para começar a anunciar, entre ou crie uma conta. Comprar não exige cadastro.'}</p></div>
  {error&&<p role="alert" className="form-error">{error}</p>}{notice&&<p role="status" className="account-notice">{notice}</p>}
  {!account&&!admin&&<div className="seller-steps" aria-label="Como anunciar em três etapas"><span><b>1</b> Entre ou crie sua conta</span><span><b>2</b> Adicione seu produto</span><span><b>3</b> Publique no bairro</span></div>}
  {!account?<form className="draft-form panel account-form" onSubmit={authenticate}>
    {register&&<label>Seu nome<input name="name" required minLength={2} maxLength={80} autoComplete="name"/></label>}
    <label>E-mail<input name="email" type="email" required maxLength={254} autoComplete="email"/></label>
    <label>Senha<input name="password" type="password" required minLength={8} maxLength={128} autoComplete={register?'new-password':'current-password'} aria-label="Senha" aria-describedby="password-help"/><span id="password-help" className="field-help">Use de 8 a 128 caracteres. Guarde sua senha: ainda não é possível recuperá-la se você esquecer.</span></label>
    {register&&<><label>Bairro<select name="neighborhood" required><option>Poranga I</option><option>Poranga II</option><option>Jacarezinho</option></select></label><label>WhatsApp<input name="whatsapp" type="tel" required maxLength={32} placeholder="(92) 99999-9999" autoComplete="tel"/></label><label className="consent"><input type="checkbox" name="acceptContact" required/>Autorizo a divulgação do nome e WhatsApp nos anúncios publicados.</label></>}
    <button className="button primary" disabled={busy} type="submit">{busy?'Aguarde…':register?'Criar conta':'Entrar'}</button>
    <button type="button" className="button outline" disabled={busy} onClick={()=>{setRegister(!register);setError('')}}>{register?'Já tenho conta':'Criar conta'}</button>
   </form>:<>
   <div className="account-toolbar"><span>{account.email} · {account.neighborhood}</span><button className="button outline" disabled={busy} onClick={()=>void execute(async()=>{await api('logout','POST',{});setAccount(null);setReadyAccount(null);setRegister(false);setOffers([]);setNotice('Você saiu da conta.')})}>Sair</button></div>
   <form className="panel password-form" onSubmit={event=>{event.preventDefault();const form=event.currentTarget,data=new FormData(form);void execute(async()=>{await api('password','POST',{oldPassword:String(data.get('oldPassword')||''),newPassword:String(data.get('newPassword')||'')});form.reset();setNotice('Senha alterada e outras sessões encerradas.')})}}>
     <details><summary>Segurança da conta — alterar minha senha</summary><div className="password-fields"><label>Senha atual<input type="password" name="oldPassword" required minLength={8} maxLength={128} autoComplete="current-password"/></label><label>Nova senha<input type="password" name="newPassword" required minLength={8} maxLength={128} autoComplete="new-password"/></label><button className="button outline" disabled={busy}>Alterar senha</button></div></details>
   </form>
   {admin&&account.role!=='admin'?<p className="local-note">Acesso restrito à administração.</p>:admin?<>
    {stats&&<div className="stat-grid"><div className="stat-card"><strong>{stats.sellers}</strong><span>Contas</span></div><div className="stat-card"><strong>{stats.published}</strong><span>Anúncios públicos</span></div><div className="stat-card"><strong>{stats.listings}</strong><span>Anúncios registrados</span></div><div className="stat-card"><strong>{stats.reports}</strong><span>Denúncias abertas</span></div></div>}
    <h2>Gestão de vendedores</h2>
    {sellers.length?<div className="draft-stack">{sellers.map(seller=><article className="panel" key={seller.id}><div className="account-toolbar"><div><strong>{seller.name}</strong><p>{seller.email} · {seller.neighborhood} · {seller.role==='admin'?'Administrador':seller.status==='suspended'?'Suspenso':'Ativo'}</p></div>{seller.id!==account.id&&<button disabled={busy} className="button outline" onClick={()=>{if(window.confirm(seller.status==='suspended'?'Reativar este vendedor?':'Suspender este vendedor e retirar suas ofertas da vitrine?'))void execute(async()=>{await api('admin/sellers/'+seller.id,'POST',{status:seller.status==='suspended'?'approved':'suspended'});await refresh();setNotice('Status atualizado.')})}}>{seller.status==='suspended'?'Reativar':'Suspender'}</button>}</div></article>)}</div>:<p className="account-notice">Nenhum vendedor cadastrado.</p>}
    <h2>Administração de anúncios</h2>
    {allListings.length?<div className="draft-stack">{allListings.map(offer=><article className="panel" key={offer.id}><div className="account-toolbar"><div><strong>{offer.title}</strong><p>{offer.seller} · {statuses[offer.status]||offer.status}</p></div><button className="button outline" disabled={busy} onClick={()=>{if(window.confirm('Remover este anúncio do catálogo?'))void execute(async()=>{await api('admin/listings/'+offer.id,'POST',{status:'removed'});await refresh();setNotice('Anúncio removido.')})}}>Remover</button></div></article>)}</div>:<p className="account-notice">Sem anúncios registrados.</p>}
    <h2>Denúncias recebidas</h2>
    {reports.length?<div className="draft-stack">{reports.map(report=><article className="panel" key={report.id}><span className="draft-status">{report.reason} · anúncio #{report.listingId}</span><h3>{report.title}</h3><p>{report.details||'Sem detalhes adicionais.'}</p><p>Status: {statuses[report.listingStatus]||report.listingStatus}</p><div className="account-toolbar"><button disabled={busy} className="button outline" onClick={()=>reviewReport(report,'dismissed')}>Arquivar denúncia</button><button disabled={busy} className="button danger" onClick={()=>reviewReport(report,'removed')}>Retirar anúncio</button>{report.sellerId&&<button disabled={busy} className="button outline" onClick={()=>{if(window.confirm('Suspender este vendedor?'))void execute(async()=>{await api('admin/sellers/'+report.sellerId,'POST',{status:'suspended'});await refresh();setNotice('Vendedor suspenso.')})}}>Suspender vendedor</button>}</div></article>)}</div>:<p className="account-notice">Nenhuma denúncia aberta.</p>}
    <h2>Ofertas sinalizadas para revisão</h2>
    {offers.length?<div className="draft-stack">{offers.map(offer=><article className="panel account-offer" key={offer.id}><span className="draft-status">Em verificação</span><h3>{offer.title}</h3><p>{offer.description}</p><p>Vendedor: {offer.seller} · {offer.whatsapp} · {offer.sellerStatus==='approved'?'Contato verificado':'Contato não verificado'}</p><div className="account-toolbar">{offer.sellerStatus==='pending'&&<button className="button outline" disabled={busy} onClick={()=>{if(window.confirm('Você confirmou que o vendedor controla o WhatsApp?'))void execute(async()=>{await api('moderation/'+offer.id+'/seller','POST',{confirmContact:true});await refresh()})}}>Confirmar vendedor</button>}<button className="button primary" disabled={busy||offer.sellerStatus!=='approved'} onClick={()=>moderate(offer,'published')}>Publicar</button><button className="button outline" disabled={busy} onClick={()=>moderate(offer,'rejected')}>Rejeitar</button></div></article>)}</div>:<p className="account-notice">Nenhuma oferta sinalizada.</p>}
   </>:<>
    <p className="account-notice">{account.status==='suspended'?'Conta suspensa.':'Seus anúncios aparecem aqui. Você pode editar, pausar ou marcar como vendido.'}</p>
    <div className="account-toolbar"><button className="button primary" aria-expanded={showForm} disabled={busy} onClick={()=>{setEditing(null);setCategory('Alimentação');setShowForm(v=>!v)}}>{showForm?'Fechar formulário':'Publicar novo anúncio'}</button><a className="button outline" href={'#vendedor-'+account.id}>Meu perfil público</a>{account.role==='admin'&&<a className="button outline" href="#admin">Administração</a>}</div>
    {showForm&&<form className="draft-form panel seller-listing-form" onSubmit={submit} key={editing?.id||requestId}>
     <h2>{editing?'Editar anúncio':'Seu anúncio começa aqui'}</h2>
     <p className="seller-form-intro">Preencha apenas o necessário. Você pode editar as informações depois.</p>
     <div className="form-step-title"><span>1</span><div><strong>Mostre o produto</strong><small>Uma foto ajuda, mas é opcional.</small></div></div>
     <PhotoPicker onFile={setSelectedPhoto} initialPhoto={selectedPhoto} storageAvailable={photoAvailable}/>
     <div className="form-step-title"><span>2</span><div><strong>Descreva sua oferta</strong><small>Informações claras facilitam a conversa.</small></div></div>
     <label>O que você está vendendo?<input name="title" placeholder="Ex.: Mesa de madeira com 4 cadeiras" required minLength={5} maxLength={90} defaultValue={editing?.title||draft?.title}/></label>
     <div className="form-row"><label>Categoria<select name="category" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c.name}>{c.name}</option>)}</select></label><label>Condição<select name="condition" aria-label="Condição" required defaultValue={editing?.condition||draft?.condition||''}><option value="" disabled>Selecione o estado</option><option>Novo</option><option>Usado</option><option>Não aplicável</option></select><span className="field-help">Escolha o estado real do produto.</span></label></div>
     <label>Preço em reais<input name="price" placeholder="Ex.: 25,00" inputMode="decimal" maxLength={20} defaultValue={editing?.priceCents?((editing.priceCents/100).toFixed(2).replace('.',',')):draft?.priceCents?((draft.priceCents/100).toFixed(2).replace('.',',')):''}/><span className="field-help">Serviços podem ser sob orçamento.</span></label>
     <label>Conte sobre o produto<textarea name="description" placeholder="Conte o estado do produto e o que está incluído." required minLength={10} maxLength={2000} defaultValue={editing?.description||draft?.description}/></label>
     <div className="form-step-title"><span>3</span><div><strong>Combine os detalhes</strong><small>Escolha o bairro e informe a entrega.</small></div></div>
     <label>Bairro<select name="neighborhood" defaultValue={editing?.neighborhood||account.neighborhood}><option>Poranga I</option><option>Poranga II</option><option>Jacarezinho</option></select></label>
     <label>Como será a entrega?<input name="fulfillment" placeholder="Ex.: Retirada no bairro, em horário combinado" required maxLength={180} defaultValue={editing?.fulfillment||draft?.fulfillment}/></label>
     <p className="seller-form-disclaimer">Confira as informações antes de publicar. O VENDE+ não recebe pagamentos, e anúncios sinalizados podem precisar de análise.</p>
     <button type="submit" className="button primary" disabled={busy}>{busy?'Salvando…':editing?'Salvar alterações':'Publicar anúncio'}</button>
     {editing&&<button type="button" className="button outline" disabled={busy} onClick={()=>{setEditing(null);setShowForm(false)}}>Cancelar edição</button>}
    </form>}
    <h2>Meus anúncios</h2>
    {offers.length?<div className="draft-stack">{offers.map(offer=><article className="panel account-offer" key={offer.id}><span className="draft-status">{statuses[offer.status]||offer.status}</span><h3>{offer.title}</h3><strong>{formatBRL(offer.priceCents)}</strong><p>{offer.description}</p><p>{offer.fulfillment}</p><div className="account-toolbar"><button className="button outline" onClick={()=>edit(offer)} disabled={busy}>Editar</button>{offer.status==='published'&&<button className="button outline" disabled={busy} onClick={()=>update(offer,'paused')}>Pausar</button>}{offer.status==='paused'&&<button className="button primary" disabled={busy} onClick={()=>update(offer,'published')}>Reativar</button>}{['published','paused'].includes(offer.status)&&<button className="button outline" disabled={busy} onClick={()=>update(offer,'sold')}>Marcar vendido</button>}<button className="button outline" disabled={busy} onClick={()=>{if(window.confirm('Remover este anúncio?'))update(offer,'removed')}}>Remover</button></div></article>)}</div>:<p className="account-notice">Você ainda não publicou nenhum anúncio.</p>}
    <form className="draft-form panel profile-form" onSubmit={saveProfile}><h2>Editar meu perfil público</h2><label>Nome comercial<input value={profileName} onChange={e=>setProfileName(e.target.value)} minLength={2} maxLength={80} required/></label><label>Sobre você ou seu negócio<textarea value={bio} onChange={e=>setBio(e.target.value)} maxLength={600}/></label><button className="button primary" disabled={busy}>Salvar perfil</button></form>
   </>}
  </>}
 </section>;
}
