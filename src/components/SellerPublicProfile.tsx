import {useEffect,useState,type FormEvent} from 'react';
import {ListingCard} from './ListingCard';
import {decodeListings} from '../lib/api';
import {ROUTES} from '../lib/routes.mjs';
import type {Listing} from '../data/marketplace';

type Seller={id:string;name:string;neighborhood:string;bio:string;slug?:string;sellerType:'person'|'business';businessName?:string;avatarUrl?:string;coverUrl?:string;contactWhatsapp?:string;createdAt:number;activeListings:number};

export function SellerPublicProfile({id}:{id:string}){
 const [seller,setSeller]=useState<Seller|null>(null),[listings,setListings]=useState<Listing[]>([]);
 const [status,setStatus]=useState('Carregando perfil…'),[attempt,setAttempt]=useState(0),[failed,setFailed]=useState(false),[report,setReport]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{
  const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),8000);let disposed=false;
  setStatus('Carregando perfil…');setFailed(false);setSeller(null);setListings([]);
  fetch('/api/sellers/'+encodeURIComponent(id),{signal:controller.signal,cache:'no-store',headers:{Accept:'application/json'}}).then(async r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{
   if(!data.seller||typeof data.seller.id!=='string'||typeof data.seller.name!=='string'||typeof data.seller.neighborhood!=='string'||typeof data.seller.bio!=='string')throw Error();
   const offers=decodeListings({listings:data.listings});
   if(!disposed){setSeller(data.seller);setListings(offers);setStatus('')}
  }).catch(()=>{if(!disposed){setStatus('Não foi possível carregar este perfil.');setFailed(true)}}).finally(()=>clearTimeout(timer));
  return ()=>{disposed=true;controller.abort();clearTimeout(timer)};
 },[id,attempt]);
 const share=async()=>{const url=location.href;try{if(navigator.share){await navigator.share({title:seller?.businessName||seller?.name||'VENDE+',url});return}await navigator.clipboard.writeText(url);setNotice('Link da vitrine copiado.')}catch{}};
 const sendReport=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const form=e.currentTarget,data=Object.fromEntries(new FormData(form));setNotice('');try{const r=await fetch('/api/sellers/'+encodeURIComponent(id)+'/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const value=await r.json();if(!r.ok)throw Error(value.error||'Não foi possível enviar.');setNotice('Denúncia recebida para análise.');setReport(false);form.reset()}catch(error){setNotice(error instanceof Error?error.message:'Não foi possível enviar.')}};
 const since=seller?.createdAt?new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(seller.createdAt*1000)):'';
 const title=seller?.sellerType==='business'&&seller.businessName?seller.businessName:seller?.name;
 const whatsapp=seller?.contactWhatsapp?'https://wa.me/'+seller.contactWhatsapp+'?text='+encodeURIComponent('Olá! Encontrei sua vitrine no VENDE+ e gostaria de conversar sobre seus anúncios.'):'';
 return <section className="seller-public"><a className="back" href={ROUTES.catalog}>Voltar às ofertas</a>
  {status?<div className="panel"><p role="status">{status}</p>{failed&&<button className="button outline" onClick={()=>setAttempt(v=>v+1)}>Tentar novamente</button>}</div>:seller&&<>
   <header className="seller-showcase">
    <div className="seller-cover">{seller.coverUrl&&<img src={seller.coverUrl} alt="" referrerPolicy="no-referrer"/>}</div>
    <div className="seller-showcase-body">
     <div className="seller-profile-avatar">{seller.avatarUrl?<img src={seller.avatarUrl} alt="" referrerPolicy="no-referrer"/>:<span>{title?.slice(0,1).toUpperCase()}</span>}</div>
     <div className="seller-profile-copy"><span className="eyebrow">{seller.sellerType==='business'?'Loja / negócio':'Pessoa'}</span><h1>{title}</h1>{seller.slug&&<strong className="seller-handle">@{seller.slug}</strong>}<p>{seller.neighborhood} · No VENDE+ desde {since}</p>{seller.bio&&<p className="seller-bio">{seller.bio}</p>}<span>{seller.activeListings} {seller.activeListings===1?'anúncio ativo':'anúncios ativos'}</span></div>
     <div className="seller-profile-actions">{whatsapp&&<a className="button primary" href={whatsapp} target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a>}<button className="button outline" onClick={()=>void share()}>Compartilhar vitrine</button><button className="button outline" onClick={()=>setReport(v=>!v)}>Denunciar vendedor</button></div>
    </div>
   </header>
   {report&&<form className="panel report-form" onSubmit={sendReport}><h2>Denunciar vendedor</h2><label>Motivo<select name="reason" defaultValue="spam"><option value="spam">Spam</option><option value="fraud">Suspeita de golpe</option><option value="impersonation">Falsa identidade</option><option value="prohibited">Conteúdo proibido</option><option value="other">Outro</option></select></label><label>Detalhes (opcional)<textarea name="details" maxLength={500} placeholder="Descreva o problema sem incluir dados pessoais."/></label><button className="button primary">Enviar denúncia</button></form>}
   {notice&&<p className="notice" role="status">{notice}</p>}
   <div className="seller-listings-heading"><div><span className="eyebrow">Vitrine</span><h2>Anúncios de {title}</h2></div></div>
   {listings.length?<div className="product-grid">{listings.map(item=><ListingCard key={item.id} listing={item}/>)}</div>:<div className="panel seller-empty"><h2>Nenhum anúncio ativo agora</h2><p>Esta vitrine continua disponível. Volte em outro momento para conferir novas ofertas.</p></div>}
  </>}
 </section>;
}