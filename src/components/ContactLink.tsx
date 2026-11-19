import type {Listing} from '../data/marketplace';
import {ActionLink} from './UI';
import {Icon} from './Icon';
export function ContactLink({listing,full=true}:{listing:Listing;full?:boolean}){
 if(!listing.canContact)return null;
 return <ActionLink className="whatsapp-contact" full={full} href={'/api/contact?listing='+listing.id} target="_blank" rel="noopener noreferrer" aria-label={'Conversar no WhatsApp sobre '+listing.title}><Icon name="message-circle"/>Conversar no WhatsApp</ActionLink>;
}
