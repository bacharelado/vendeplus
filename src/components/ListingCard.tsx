import type {Listing} from '../data/marketplace';
import {categories} from '../data/marketplace';
import {formatBRL} from '../lib/pricing.mjs';
import {Icon} from './Icon';
export function ListingCard({listing}:{listing:Listing}){
  return <a className="listing-card" href={`#anuncio-${listing.id}`} aria-label={`Ver anúncio: ${listing.title}`}>
    <div className="listing-image"><span aria-hidden="true">{categories.find(c=>c.name===listing.category)?.emoji||'📦'}</span>{listing.image&&<img src={listing.image} alt={listing.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.hidden=true}}/>}<span className="condition-badge">{listing.condition}</span></div>
    <div className="listing-body"><span className="listing-category">{listing.category}</span><h3>{listing.title}</h3><strong className="price">{formatBRL(listing.priceCents)}</strong><small>{listing.seller}</small><span className="listing-location"><Icon name="pin"/>Poranga e Jacarezinho</span></div>
  </a>;
}
