import type {Listing} from '../data/marketplace';
import {ActionLink} from './UI';
import {Icon} from './Icon';
export function ContactLink({listing,full=true}:{listing:Listing;full?:boolean}){
 if(!listing.contactWhatsapp)return null;
 const link=location.origin+location.pathname+'#anuncio-'+listing.id;
 const message='Olá! Tenho interesse no anúncio '+listing.title+' que vi no VENDE+. '+link;
 return <ActionLink className="whatsapp-contact" full={full} href={'https://wa.me/'+listing.contactWhatsapp+'?text='+encodeURIComponent(message)} target="_blank" rel="noopener noreferrer" aria-label={'Conversar no WhatsApp sobre '+listing.title}><Icon name="message-circle"/>Conversar no WhatsApp</ActionLink>;
}
