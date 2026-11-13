import type {Listing} from '../data/marketplace';
import {formatBRL} from '../lib/pricing.mjs';
import {Icon} from './Icon';
import {ContactLink} from './ContactLink';
import {listingHref} from '../lib/routes.mjs';
export function ListingCard({listing}:{listing:Listing}){
 return <article className="listing-card">
  <a className="listing-main" href={listingHref(listing.id)} aria-label={'Ver anúncio: '+listing.title}>
   <div className="listing-image"><span className="listing-placeholder" aria-hidden="true"><Icon name="bag"/></span>{listing.image&&<img src={listing.image} alt={listing.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.hidden=true}}/>}<span className="condition-badge">{listing.condition}</span></div>
   <div className="listing-body"><span className="listing-category">{listing.category}</span><h3>{listing.title}</h3><strong className="price">{formatBRL(listing.priceCents)}</strong><span className="listing-location"><Icon name="pin"/>{listing.neighborhood||'Poranga e Jacarezinho'}</span><small>{listing.seller}</small><span className="listing-action">Ver detalhes<Icon name="arrow"/></span></div>
  </a>
  {listing.contactWhatsapp&&<div className="listing-contact"><ContactLink listing={listing}/></div>}
 </article>;
}
