import {useEffect,useRef,useState,type FormEvent} from 'react';
import {PhotoPicker} from './PhotoAssistant';
import {videoIdFromUrl,videoWatchUrl} from '../lib/video.mjs';
import {Button,Field} from './UI';
import {DraftList} from './DraftList';
import {categories,type Draft} from '../data/marketplace';
import {formatBRL,parseBRL} from '../lib/pricing.mjs';
import {normalizeWhatsapp} from '../lib/phone.mjs';
import {createDraftId,readDrafts,writeDrafts} from '../lib/drafts.mjs';
import {listingNotice} from '../lib/listing-notice.mjs';
import {ROUTES,listingHref,sellerHref,publishDraftHref,publishEditHref} from '../lib/routes.mjs';
import {SUPPORT_WHATSAPP_URL} from '../lib/support.mjs';

type Account={id:string;name:string;email:string;neighborhood:string;role:'seller'|'admin';status:string;whatsapp?:string};
type Offer={id:number;title:string;description:string;priceCents:number|null;status:string;fulfillment:string;category:string;condition:string;neighborhood?:string;seller?:string;whatsapp?:string;sellerStatus?:string;videoId?:string|null};
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
async function uploadPhoto(id:number,file:File):Promise<string>{
 const image=await preparePhoto(file);
 const response=await fetch('/api/media-upload?listingId='+id,{method:'POST',headers:{'Content-Type':image.type},body:image,credentials:'same-origin',signal:AbortSignal.timeout(30000)});
 const value=await response.json();
 if(!response.ok)throw new Error(value.error||'Não foi possível enviar a foto.');
 return typeof value.warning==='string'?' '+value.warning:'';
}
export function SellerArea({draft:providedDraft,admin=false,initialPhoto=null,startNew=false,view='area',draftId,editId}:{draft?:Draft;admin?:boolean;initialPhoto?:File|null;startNew?:boolean;view?:'entrar'|'area'|'publicar';draftId?:string;editId?:number}){
 const [draft]=useState<Draft|undefined>(()=>{if(providedDraft)return providedDraft;try{return readDrafts(localStorage).find(item=>item.id===draftId)}catch{return undefined}});

 const [selectedPhoto,setSelectedPhoto]=useState<File|null>(initialPhoto);
 const [photoAvailable,setPhotoAvailable]=useState<boolean>();
 useEffect(()=>{let active=true;fetch('/api/media-upload',{cache:'no-store',signal:AbortSignal.timeout(8000)}).then(async response=>{const value=await response.json();if(active)setPhotoAvailable(response.ok&&value.available===true)}).catch(()=>{if(active)setPhotoAvailable(false)});return ()=>{active=false}},[]);
 const [account,setAccount]=useState<Account|null>(null),[loading,setLoading]=useState(true),[register,setRegister]=useState(location.hash===ROUTES.register);
 const [offers,setOffers]=useState<Offer[]>([]),[reports,setReports]=useState<Report[]>([]),[stats,setStats]=useState<Stats|null>(null);
 const [sellers,setSellers]=useState<AdminSeller[]>([]),[allListings,setAllListings]=useState<AdminListing[]>([]);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [category,setCategory]=useState<string>(draft?.category||'Alimentação'),[requestId,setRequestId]=useState(createDraftId),[showForm,setShowForm]=useState(view==='publicar'||!!draft||startNew),[editing,setEditing]=useState<Offer|null>(null);
 const [profileName,setProfileName]=useState(''),[bio,setBio]=useState('');
 const [lastPublished,setLastPublished]=useState<number|null>(null);
 const [offerFilter,setOfferFilter]=useState('all'),[offerQuery,setOfferQuery]=useState('');
 const [photoRetry,setPhotoRetry]=useState<{id:number;file:File}|null>(null);
 const initializedEdit=useRef<number|undefined>(undefined);
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
 useEffect(()=>{
  if(loading||admin)return;
  if(!account&&(view==='publicar'||view==='area')){
   try{sessionStorage.setItem('vendeplus:after-login',view==='area'?ROUTES.account:draftId?publishDraftHref(draftId):editId?publishEditHref(editId):ROUTES.publish)}catch{}
   location.hash=ROUTES.login;
  }else if(account&&view==='entrar'){
   let target='#area';try{const saved=sessionStorage.getItem('vendeplus:after-login');if(saved&&/^(?:#area|#publicar(?:\?(?:rascunho|anuncio)=[a-zA-Z0-9-]+)?)$/.test(saved))target=saved;sessionStorage.removeItem('vendeplus:after-login')}catch{}
   location.hash=target;
  }
 },[loading,account,admin,view,draftId,editId]);
 useEffect(()=>{
  if(view!=='publicar'||!account||readyAccount!==account.id)return;
  if(draftId&&!draft){setError('Este rascunho não está salvo neste navegador.');setShowForm(false);return}
  if(editId&&initializedEdit.current!==editId){const own=offers.find(offer=>offer.id===editId);if(!own){setError('Anúncio não encontrado na sua conta.');setShowForm(false);return}initializedEdit.current=editId;setEditing(own);setCategory(own.category);setShowForm(true)}
 },[view,account,readyAccount,editId,draftId,draft,offers]);
 const execute=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');setNotice('');setLastPublished(null);try{await fn()}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível concluir a solicitação.')}finally{setBusy(false)}};
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
  const videoUrl=String(data.videoUrl||'').trim();
  if(videoUrl&&!videoIdFromUrl(videoUrl)){setError('Insira um link válido do YouTube (vídeo ou Shorts).');return}
  const price=parseBRL(data.price,category==='Serviços');if(!price.ok){setError(price.error);return}
  void execute(async()=>{
   const payload={...data,fulfillment:String(data.fulfillment||'').trim()||(category==='Serviços'?'Atendimento a combinar pelo WhatsApp.':'Retirada ou entrega a combinar pelo WhatsApp.'),priceCents:price.cents,...(editing?{action:'edit'}:{requestId})};
   const result=await api(editing?'listings/'+editing.id:'listings',editing?'PATCH':'POST',payload);
   const id=editing?.id||Number(result.id);
   let draftNotice='';
   if(!editing&&draft){
    try{const saved=readDrafts(localStorage);if(saved.some(item=>item.id===draft.id))writeDrafts(localStorage,saved.filter(item=>item.id!==draft.id))}
    catch{draftNotice=' Não foi possível remover o rascunho deste navegador. Exclua-o em Minha área para evitar publicar novamente.'}
   }
   let photoNotice=photo&&photoAvailable===false?' O anúncio foi salvo sem foto porque o envio de imagens está indisponível.':'';
   setPhotoRetry(null);
   if(photo&&photo.size&&photoAvailable){
    try{
     photoNotice=await uploadPhoto(id,photo);
    }catch(reason){setPhotoRetry({id,file:photo});photoNotice=' A oferta foi salva, mas a foto não: '+(reason instanceof Error?reason.message:'erro de envio')+'.'}
   }
   setRequestId(createDraftId());setShowForm(false);setEditing(null);setSelectedPhoto(null);
   setLastPublished(result.status==='published'?id:null);
   const savedNotice=listingNotice(result.status)+photoNotice+draftNotice;
   setNotice(savedNotice);
   try{await refresh()}catch{setNotice(savedNotice+' Não foi possível atualizar sua lista. Consulte Minha área novamente.')}
  });
 };
 const startAnother=()=>{
  if(editId||draftId){location.hash=ROUTES.publish;return}
  setRequestId(createDraftId());setCategory('Alimentação');setSelectedPhoto(null);setPhotoRetry(null);setLastPublished(null);setNotice('');setError('');setShowForm(true);
 };
 const edit=(offer:Offer)=>{location.hash=publishEditHref(offer.id)};
 const update=(offer:Offer,status:string)=>void execute(async()=>{const result=await api('listings/'+offer.id,'PATCH',{status});await refresh();setNotice(result.warning||(result.status==='pending'?'O anúncio foi enviado para análise antes de voltar à vitrine.':status==='removed'?'Anúncio removido.':'Anúncio atualizado.'))});
 const moderate=(offer:Offer,status:string)=>void execute(async()=>{await api('moderation/'+offer.id,'POST',{status});await refresh();setNotice('Decisão registrada.')});
 const reviewReport=(report:Report,decision:'dismissed'|'removed')=>{if(decision==='removed'&&!window.confirm('Retirar este anúncio do catálogo?'))return;void execute(async()=>{await api('admin/reports/'+report.id,'POST',{decision});await refresh();setNotice('Denúncia resolvida.')})};
 const saveProfile=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();void execute(async()=>{await api('profile','PATCH',{name:profileName,bio});await refresh(true);setNotice('Perfil atualizado.')})};
 const counts={published:offers.filter(item=>item.status==='published').length,paused:offers.filter(item=>item.status==='paused').length,sold:offers.filter(item=>item.status==='sold').length,pending:offers.filter(item=>item.status==='pending').length};
 const visibleOffers=offers.filter(item=>(offerFilter==='all'||item.status===offerFilter)&&item.title.toLocaleLowerCase('pt-BR').includes(offerQuery.trim().toLocaleLowerCase('pt-BR')));
 const filters=[{id:'all',label:'Todos'},{id:'published',label:'Publicados'},{id:'paused',label:'Pausados'},{id:'sold',label:'Vendidos'},{id:'pending',label:'Em análise'},{id:'rejected',label:'Não aprovados'}];
 if(loading||!account&&!admin&&(view==='publicar'||view==='area')||account&&(!admin||account.role==='admin')&&readyAccount!==account.id)return <div className="catalog-loading" role="status">Carregando sua conta…</div>;
 return <section className="account-area">
  <div className="page-heading"><span className="eyebrow">VENDE+ · Poranga e Jacarezinho</span><h1>{admin?'Administração do site.':view==='publicar'?(editId?'Editar anúncio.':'Publicar anúncio.'):view==='area'?'Minha área.':register?'Crie sua conta.':'Entre na sua conta.'}</h1><p>{account?'Olá, '+account.name+'.':register?'Use nome, e-mail, bairro e WhatsApp para criar sua conta. Depois, adicione o produto e publique.':'Entre para publicar e gerenciar seus anúncios. Quem compra não precisa de conta.'}</p></div>
  {error&&<p role="alert" className="form-error">{error}</p>}{notice&&<div role="status" className="account-notice"><p>{notice}</p>{lastPublished&&<a className="text-link" href={listingHref(lastPublished)}>Ver meu anúncio na vitrine →</a>}</div>}
  {photoRetry&&<div className="panel"><p>A foto escolhida continua disponível enquanto esta página estiver aberta.</p><Button disabled={busy} onClick={()=>void execute(async()=>{const warning=await uploadPhoto(photoRetry.id,photoRetry.file);setPhotoRetry(null);setNotice('Foto salva no anúncio.'+warning)})}>Tentar enviar a foto novamente</Button></div>}
  {view==='publicar'&&<a className="back" href={ROUTES.account}>← Voltar à Minha área</a>}
  {view==='publicar'&&!showForm&&notice&&<Button disabled={busy} onClick={startAnother}>Publicar outro anúncio</Button>}
  {!account?<form className="draft-form panel account-form" onSubmit={authenticate}>
    <div className="auth-switch" aria-label="Escolha como acessar"><Button variant={register?'outline':'primary'} aria-pressed={!register} disabled={busy} onClick={()=>{setRegister(false);setError('')}}>Entrar</Button><Button variant={register?'primary':'outline'} aria-pressed={register} disabled={busy} onClick={()=>{setRegister(true);setError('')}}>Criar conta</Button></div>
    {register&&<p className="auth-purpose">Sua conta permite editar o anúncio, pausar ou marcar como vendido.</p>}
    {register&&<Field label="Seu nome"><input name="name" required minLength={2} maxLength={80} autoComplete="name"/></Field>}
    <Field label="E-mail"><input name="email" type="email" required maxLength={254} autoComplete="email"/></Field>
    <label>Senha<input name="password" type="password" required minLength={8} maxLength={128} autoComplete={register?'new-password':'current-password'} aria-label="Senha" aria-describedby="password-help"/><span id="password-help" className="field-help">Use de 8 a 128 caracteres.</span></label>
    {register&&<><label>Bairro<select name="neighborhood" required><option>Poranga I</option><option>Poranga II</option><option>Jacarezinho</option></select></label><label>WhatsApp<input name="whatsapp" type="tel" required maxLength={32} placeholder="(92) 99999-9999" autoComplete="tel"/></label><label className="consent"><input type="checkbox" name="acceptContact" required/>Autorizo a divulgação do nome e WhatsApp nos anúncios publicados.</label></>}
    {!register&&<a className="text-link" href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">Precisa de ajuda para entrar? Fale no WhatsApp</a>}
    <Button disabled={busy} type="submit">{busy?'Aguarde…':register?'Criar minha conta':'Entrar na minha conta'}</Button>

   </form>:<>
   <div className="account-toolbar"><span>{account.email} · {account.neighborhood}</span><button className="button outline" disabled={busy} onClick={()=>void execute(async()=>{await api('logout','POST',{});setAccount(null);setReadyAccount(null);setRegister(false);setOffers([]);setNotice('Você saiu da conta.')})}>Sair</button></div>
   {view!=='publicar'&&<form className="panel password-form" onSubmit={event=>{event.preventDefault();const form=event.currentTarget,data=new FormData(form);void execute(async()=>{await api('password','POST',{oldPassword:String(data.get('oldPassword')||''),newPassword:String(data.get('newPassword')||'')});form.reset();setNotice('Senha alterada e outras sessões encerradas.')})}}>
     <details><summary>Segurança da conta — alterar minha senha</summary><div className="password-fields"><label>Senha atual<input type="password" name="oldPassword" required minLength={8} maxLength={128} autoComplete="current-password"/></label><label>Nova senha<input type="password" name="newPassword" required minLength={8} maxLength={128} autoComplete="new-password"/></label><button className="button outline" disabled={busy}>Alterar senha</button></div></details>
   </form>}
   {admin&&account.role!=='admin'?<p className="local-note">Acesso restrito à administração.</p>:admin?<>
    {stats&&<div className="stat-grid"><div className="stat-card"><strong>{stats.sellers}</strong><span>Contas</span></div><div className="stat-card"><strong>{stats.published}</strong><span>Anúncios públicos</span></div><div className="stat-card"><strong>{stats.listings}</strong><span>Anúncios registrados</span></div><div className="stat-card"><strong>{stats.reports}</strong><span>Denúncias abertas</span></div></div>}
    <h2>Gestão de vendedores</h2>
    {sellers.length?<div className="draft-stack">{sellers.map(seller=><article className="panel" key={seller.id}><div className="account-toolbar"><div><strong>{seller.name}</strong><p>{seller.email} · {seller.neighborhood} · {seller.role==='admin'?'Administrador':seller.status==='suspended'?'Suspenso':seller.status==='approved'?'Contato confirmado':'Contato não verificado'}</p></div>{seller.id!==account.id&&<button disabled={busy} className="button outline" onClick={()=>{if(window.confirm(seller.status==='suspended'?'Reativar este vendedor?':'Suspender este vendedor e retirar suas ofertas da vitrine?'))void execute(async()=>{await api('admin/sellers/'+seller.id,'POST',{status:seller.status==='suspended'?'approved':'suspended'});await refresh();setNotice('Status atualizado.')})}}>{seller.status==='suspended'?'Reativar':'Suspender'}</button>}</div></article>)}</div>:<p className="account-notice">Nenhum vendedor cadastrado.</p>}
    <h2>Administração de anúncios</h2>
    {allListings.length?<div className="draft-stack">{allListings.map(offer=><article className="panel" key={offer.id}><div className="account-toolbar"><div><strong>{offer.title}</strong><p>{offer.seller} · {statuses[offer.status]||offer.status}</p></div><button className="button outline" disabled={busy} onClick={()=>{if(window.confirm('Remover este anúncio do catálogo?'))void execute(async()=>{await api('admin/listings/'+offer.id,'POST',{status:'removed'});await refresh();setNotice('Anúncio removido.')})}}>Remover</button></div></article>)}</div>:<p className="account-notice">Sem anúncios registrados.</p>}
    <h2>Denúncias recebidas</h2>
    {reports.length?<div className="draft-stack">{reports.map(report=><article className="panel" key={report.id}><span className="draft-status">{report.reason} · anúncio #{report.listingId}</span><h3>{report.title}</h3><p>{report.details||'Sem detalhes adicionais.'}</p><p>Status: {statuses[report.listingStatus]||report.listingStatus}</p><div className="account-toolbar"><button disabled={busy} className="button outline" onClick={()=>reviewReport(report,'dismissed')}>Arquivar denúncia</button><button disabled={busy} className="button danger" onClick={()=>reviewReport(report,'removed')}>Retirar anúncio</button>{report.sellerId&&<button disabled={busy} className="button outline" onClick={()=>{if(window.confirm('Suspender este vendedor?'))void execute(async()=>{await api('admin/sellers/'+report.sellerId,'POST',{status:'suspended'});await refresh();setNotice('Vendedor suspenso.')})}}>Suspender vendedor</button>}</div></article>)}</div>:<p className="account-notice">Nenhuma denúncia aberta.</p>}
    <h2>Ofertas sinalizadas para revisão</h2>
    {offers.length?<div className="draft-stack">{offers.map(offer=><article className="panel account-offer" key={offer.id}><span className="draft-status">Em verificação</span><h3>{offer.title}</h3><p>{offer.description}</p><p>Vendedor: {offer.seller} · {offer.whatsapp} · {offer.sellerStatus==='approved'?'Contato verificado':'Contato não verificado'}</p>{offer.videoId&&videoWatchUrl(offer.videoId)&&<p><a className="text-link" target="_blank" rel="noopener noreferrer" href={videoWatchUrl(offer.videoId)!}>Assistir ao vídeo antes de decidir</a></p>}<div className="account-toolbar">{offer.sellerStatus==='pending'&&<button className="button outline" disabled={busy} onClick={()=>{if(window.confirm('Você confirmou que o vendedor controla o WhatsApp?'))void execute(async()=>{await api('moderation/'+offer.id+'/seller','POST',{confirmContact:true});await refresh()})}}>Confirmar vendedor</button>}<button className="button primary" disabled={busy||offer.sellerStatus!=='approved'} onClick={()=>moderate(offer,'published')}>Publicar</button><button className="button outline" disabled={busy} onClick={()=>moderate(offer,'rejected')}>Rejeitar</button></div></article>)}</div>:<p className="account-notice">Nenhuma oferta sinalizada.</p>}
   </>:<>
    <p className="account-notice">{account.status==='suspended'?'Conta suspensa.':account.status==='pending'?'Seu contato ainda não foi confirmado pela administração. Você pode gerenciar seus anúncios, mas não informe aos compradores que seu número foi verificado.':'Seus anúncios aparecem aqui. Você pode editar, pausar ou marcar como vendido.'}</p>
    {view==='area'&&<div className="account-toolbar"><a className="button primary" href={ROUTES.publish}>Publicar novo anúncio</a><a className="button outline" href={sellerHref(account.id)}>Meu perfil público</a>{account.role==='admin'&&<a className="button outline" href={ROUTES.admin}>Administração</a>}</div>}

    {view==='publicar'&&showForm&&(!editId||editing)&&<form className="draft-form panel seller-listing-form" onSubmit={submit} key={editing?.id||requestId}>
     <h2>{editing?'Editar anúncio':'Seu anúncio começa aqui'}</h2>
     <p className="seller-form-intro">Preencha apenas o necessário. Você pode editar as informações depois.</p>
     <PhotoPicker onFile={setSelectedPhoto} initialPhoto={selectedPhoto} storageAvailable={photoAvailable}/>
     <Field label="Nome do produto ou serviço"><input name="title" placeholder="Ex.: Mesa de madeira com 4 cadeiras" required minLength={5} maxLength={90} defaultValue={editing?.title||draft?.title}/></Field>
     <div className="form-row">
      <Field label="Preço (R$)" hint={category==='Serviços'?'Deixe em branco para combinar um orçamento.':'Informe o valor total do produto.'}><input name="price" placeholder="Ex.: 25,00" inputMode="decimal" required={category!=='Serviços'} maxLength={20} defaultValue={(editing?.priceCents??draft?.priceCents)!=null?((Number(editing?.priceCents??draft?.priceCents)/100).toFixed(2).replace('.',',')):''}/></Field>
      <Field label="Bairro"><select name="neighborhood" defaultValue={editing?.neighborhood||account.neighborhood}><option>Poranga I</option><option>Poranga II</option><option>Jacarezinho</option></select></Field>
     </div>
     <div className="form-row">
      <Field label="Categoria"><select name="category" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c.name}>{c.name}</option>)}</select></Field>
      <Field label="Condição"><select name="condition" aria-label="Condição" required defaultValue={editing?.condition||draft?.condition||''}><option value="" disabled>Selecione o estado</option><option>Novo</option><option>Usado</option><option>Não aplicável</option></select></Field>
     </div>
     <Field label="Vídeo do produto (opcional)" hint="Cole um link público ou não listado do YouTube ou YouTube Shorts. Não é necessário pagar por armazenamento. Anúncios com vídeo novo passam por revisão."><input name="videoUrl" type="url" maxLength={300} placeholder="https://www.youtube.com/shorts/..." inputMode="url" defaultValue={editing?.videoId?videoWatchUrl(editing.videoId)||'':''}/></Field>
     <Field label="Descrição" hint="Conte o estado, os detalhes e o que está incluído."><textarea name="description" placeholder="Ex.: Mesa usada, bem conservada, com quatro cadeiras." required minLength={10} maxLength={2000} defaultValue={editing?.description||draft?.description}/></Field>
     <Field label={category==='Serviços'?'Atendimento (opcional)':'Entrega ou retirada (opcional)'} hint="Se deixar em branco, vocês combinam pelo WhatsApp."><input name="fulfillment" placeholder={category==='Serviços'?'Ex.: Atendimento remoto ou no local':'Ex.: Retirada no Poranga II'} maxLength={180} defaultValue={editing?.fulfillment||draft?.fulfillment}/></Field>
     <div className="contact-summary"><strong>WhatsApp para receber interessados</strong><span>{account.whatsapp||'O número cadastrado na sua conta'}</span><small>O contato da sua conta acompanha o anúncio automaticamente.</small></div>
     <p className="seller-form-disclaimer">Seu contato aparece no anúncio. Anúncios sinalizados podem precisar de análise. O VENDE+ não recebe pagamentos.</p>
     <div className="publish-actions"><Button type="submit" full disabled={busy}>{busy?'Salvando…':editing?'Salvar alterações':'Publicar anúncio'}</Button></div>
     {editing&&<button type="button" className="button outline" disabled={busy} onClick={()=>{location.hash=ROUTES.account}}>Cancelar edição</button>}
    </form>}
    {view==='area'&&<>
    <section className="seller-dashboard" aria-labelledby="seller-dashboard-title">
      <div className="seller-dashboard-heading"><div><span className="eyebrow">VENDE+ SELLER</span><h2 id="seller-dashboard-title">Visão geral dos seus anúncios</h2><p>Organize suas ofertas e acompanhe o que está publicado.</p></div><a className="button primary" href={ROUTES.publish}>+ Novo anúncio</a></div>
      <div className="seller-metric-grid" aria-label="Resumo das ofertas">
        <div className="seller-metric"><strong>{counts.published}</strong><span>Publicados</span></div>
        <div className="seller-metric"><strong>{counts.paused}</strong><span>Pausados</span></div>
        <div className="seller-metric"><strong>{counts.sold}</strong><span>Marcados vendidos</span></div>
        <div className="seller-metric"><strong>{counts.pending}</strong><span>Em análise</span></div>
      </div>
      <p className="seller-metric-note">Estes números vêm dos seus anúncios; ainda não medem visualizações, conversas iniciadas ou vendas confirmadas.</p>
      <div className="seller-dashboard-controls">
        <label className="seller-search">Buscar meus anúncios<input type="search" placeholder="Nome do produto ou serviço" value={offerQuery} onChange={event=>setOfferQuery(event.target.value)} maxLength={90}/></label>
        <div className="seller-filter-group" role="group" aria-label="Filtrar anúncios por situação">{filters.map(item=><button type="button" key={item.id} className="seller-filter" aria-pressed={offerFilter===item.id} onClick={()=>setOfferFilter(item.id)}>{item.label}</button>)}</div>
      </div>
      <div className="seller-list-title"><h2>Meus anúncios</h2><span role="status">{visibleOffers.length} {visibleOffers.length===1?'resultado':'resultados'}</span></div>
      {visibleOffers.length?<div className="draft-stack">{visibleOffers.map(offer=><article className="panel account-offer" key={offer.id}>
        <div className="seller-offer-top"><span className="draft-status">{statuses[offer.status]||offer.status}</span><span className="seller-offer-price">{formatBRL(offer.priceCents)}</span></div>
        <h3>{offer.title}</h3><p className="seller-offer-description">{offer.description}</p>
        <div className="seller-offer-meta"><span>{offer.neighborhood||account.neighborhood}</span><span>{offer.category}</span></div>
        <div className="seller-offer-actions">
          <button className="button outline" onClick={()=>edit(offer)} disabled={busy}>Editar</button>
          {offer.status==='published'&&<a className="button outline" href={listingHref(offer.id)}>Ver na vitrine</a>}
          {offer.status==='published'&&<button className="button outline" disabled={busy} onClick={()=>update(offer,'paused')}>Pausar</button>}
          {offer.status==='paused'&&<button className="button primary" disabled={busy} onClick={()=>update(offer,'published')}>Reativar</button>}
          {['published','paused'].includes(offer.status)&&<button className="button outline" disabled={busy} onClick={()=>update(offer,'sold')}>Marcar vendido</button>}
          <button className="button outline" disabled={busy} onClick={()=>{if(window.confirm('Remover este anúncio?'))update(offer,'removed')}}>Remover</button>
        </div>
      </article>)}</div>:<div className="panel seller-empty">{offers.length?'Nenhum anúncio corresponde à sua busca ou filtro.':'Você ainda não publicou nenhum anúncio.'}{offers.length&&<button type="button" className="button outline" onClick={()=>{setOfferFilter('all');setOfferQuery('')}}>Limpar filtros</button>}</div>}
    </section>
    <DraftList/>
    <details className="panel profile-settings"><summary>Editar meu perfil público</summary><form className="draft-form profile-form" onSubmit={saveProfile}><h2>Editar meu perfil público</h2><label>Nome comercial<input value={profileName} onChange={e=>setProfileName(e.target.value)} minLength={2} maxLength={80} required/></label><label>Sobre você ou seu negócio<textarea value={bio} onChange={e=>setBio(e.target.value)} maxLength={600}/></label><Button type="submit" disabled={busy}>Salvar perfil</Button></form></details></>}
   </>}
  </>}
 </section>;
}
