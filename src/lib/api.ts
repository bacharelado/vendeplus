import {categories,type Listing} from '../data/marketplace';
export type CatalogState={kind:'loading'|'ready'|'unavailable';listings:Listing[]};
export function decodeListings(payload:unknown):Listing[]{
  if(!payload||typeof payload!=='object'||!('listings' in payload)||!Array.isArray(payload.listings))throw new Error('Catálogo indisponível');
  return payload.listings.map((value:unknown)=>{
    if(!value||typeof value!=='object')throw new Error('Anúncio inválido');
    const item=value as Record<string,unknown>;
    if(!Number.isSafeInteger(item.id)||Number(item.id)<=0||typeof item.title!=='string'||typeof item.description!=='string'||typeof item.seller!=='string'||typeof item.fulfillment!=='string'||!categories.some(c=>c.name===item.category)||!['Novo','Usado','Não aplicável'].includes(String(item.condition))||item.status!=='PUBLICADO'||!Number.isSafeInteger(item.createdAt))throw new Error('Anúncio inválido');
    if(item.priceCents!==null&&(!Number.isSafeInteger(item.priceCents)||Number(item.priceCents)<=0))throw new Error('Preço inválido');
    const image=typeof item.image==='string'&&/^https:\/\//i.test(item.image)?item.image:undefined;
    const contactWhatsapp=typeof item.contactWhatsapp==='string'&&/^55\d{10,11}$/.test(item.contactWhatsapp)?item.contactWhatsapp:undefined;
    return {...item,image,contactWhatsapp} as Listing;
  });
}
export async function fetchCatalog(signal:AbortSignal):Promise<Listing[]>{
  const response=await fetch('/api/listings',{signal,headers:{Accept:'application/json'},cache:'no-store'});
  if(!response.ok)throw new Error('Catálogo indisponível');
  return decodeListings(await response.json());
}

export async function fetchCatalogPage(signal:AbortSignal,before?:string):Promise<{listings:Listing[];nextCursor?:string}>{
 const response=await fetch('/api/listings'+(before?'?before='+encodeURIComponent(before):''),{signal,headers:{Accept:'application/json'},cache:'no-store'});
 if(!response.ok)throw new Error('Não foi possível carregar os anúncios.');
 const value=await response.json();
 return {listings:decodeListings(value),nextCursor:typeof value.nextCursor==='string'?value.nextCursor:undefined};
}
export async function fetchListing(id:number,signal:AbortSignal):Promise<Listing|undefined>{
 const response=await fetch('/api/listings?id='+id,{signal,headers:{Accept:'application/json'},cache:'no-store'});
 if(!response.ok)throw new Error('Não foi possível carregar o anúncio.');
 return decodeListings(await response.json())[0];
}
