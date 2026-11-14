import {useEffect,useState} from 'react';
import {ListingCard} from './ListingCard';
import {decodeListings} from '../lib/api';
import {ROUTES} from '../lib/routes.mjs';
import type {Listing} from '../data/marketplace';
type Seller={id:string;name:string;neighborhood:string;bio:string};
export function SellerPublicProfile({id}:{id:string}){
 const [seller,setSeller]=useState<Seller|null>(null);
 const [listings,setListings]=useState<Listing[]>([]);
 const [status,setStatus]=useState('Carregando perfil…');
 const [attempt,setAttempt]=useState(0),[failed,setFailed]=useState(false);
 useEffect(()=>{
  const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),8000);let disposed=false;
  setStatus('Carregando perfil…');setFailed(false);setSeller(null);setListings([]);
  fetch('/api/sellers/'+id,{signal:controller.signal,cache:'no-store',headers:{Accept:'application/json'}}).then(async r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{
   if(!data.seller||data.seller.id!==id||typeof data.seller.name!=='string'||typeof data.seller.neighborhood!=='string'||typeof data.seller.bio!=='string')throw Error();
   const offers=decodeListings({listings:data.listings});
   if(!disposed){setSeller(data.seller);setListings(offers);setStatus('')}
  }).catch(()=>{if(!disposed){setStatus('Não foi possível carregar este perfil.');setFailed(true)}}).finally(()=>clearTimeout(timer));
  return ()=>{disposed=true;controller.abort();clearTimeout(timer)};
 },[id,attempt]);
 return <section className="seller-public"><a className="back" href={ROUTES.catalog}>Voltar às ofertas</a>{status?<div className="panel"><p role="status">{status}</p>{failed&&<button className="button outline" onClick={()=>setAttempt(value=>value+1)}>Tentar novamente</button>}</div>:seller&&<><div className="panel"><span className="eyebrow">Anunciante do bairro</span><h1>{seller.name}</h1><p>{seller.neighborhood}</p>{seller.bio&&<p>{seller.bio}</p>}</div><h2>Ofertas de {seller.name}</h2>{listings.length?<div className="product-grid">{listings.map(item=><ListingCard key={item.id} listing={item}/>)}</div>:<p>Nenhuma oferta pública no momento.</p>}</>}</section>;
}
