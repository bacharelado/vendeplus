import {useEffect,useState} from 'react';
import {ListingCard} from './ListingCard';
import {decodeListings} from '../lib/api';
import type {Listing} from '../data/marketplace';
type Seller={id:string;name:string;neighborhood:string;bio:string};
export function SellerPublicProfile({id}:{id:string}){
 const [seller,setSeller]=useState<Seller|null>(null);
 const [listings,setListings]=useState<Listing[]>([]);
 const [status,setStatus]=useState('Carregando perfil…');
 useEffect(()=>{const controller=new AbortController();fetch('/api/sellers/'+id,{signal:controller.signal,headers:{Accept:'application/json'}}).then(async r=>{if(!r.ok)throw Error('Perfil indisponível');return r.json()}).then(data=>{setSeller(data.seller);setListings(decodeListings({listings:data.listings}));setStatus('')}).catch(()=>{if(!controller.signal.aborted)setStatus('Não foi possível carregar este perfil.')});return ()=>controller.abort()},[id]);
 return <section className="seller-public"><a className="back" href="#catalogo">Voltar às ofertas</a>{status?<p role="status">{status}</p>:seller&&<><div className="panel"><span className="eyebrow">Anunciante do bairro</span><h1>{seller.name}</h1><p>{seller.neighborhood}</p>{seller.bio&&<p>{seller.bio}</p>}</div><h2>Ofertas de {seller.name}</h2>{listings.length?<div className="product-grid">{listings.map(item=><ListingCard key={item.id} listing={item}/>)}</div>:<p>Nenhuma oferta pública no momento.</p>}</>}</section>;
}
