import type { Listing } from '../data/mock';
import {formatBRL} from '../lib/pricing.mjs';

type Props = {listing: Listing};
export function ListingCard({listing}:Props) {
  return <a className="listing-card" href={`#anuncio-${listing.id}`} aria-label={`Ver anúncio: ${listing.title}`}>
    <div className="listing-image" aria-hidden="true">
      <span className="photo-fallback">{listing.emoji}</span>
      {listing.image && <img src={listing.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.hidden=true}} />}
      <span className="listing-image-label">Foto ilustrativa</span>
    </div>
    <div className="listing-body">
      <strong className="price">{formatBRL(listing.priceCents)}</strong>
      <span className="listing-title">{listing.title}</span>
      <small>{listing.seller} · {listing.category}</small>
    </div>
  </a>;
}
