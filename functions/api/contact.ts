import type {Database} from '../_shared/account.ts';

export async function onRequest({request,env}:{request:Request;env:{MARKETPLACE_DB?:Database}}){
  const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','Content-Type':'text/plain; charset=utf-8'};
  const fail=(message:string,status:number)=>new Response(message,{status,headers});
  if(request.method!=='GET')return new Response(null,{status:405,headers:{...headers,Allow:'GET'}});
  const url=new URL(request.url),listing=url.searchParams.get('listing'),seller=url.searchParams.get('seller');
  if(Number(listing!==null)+Number(seller!==null)!==1||
    (listing!==null&&(!/^[1-9]\d*$/.test(listing)||!Number.isSafeInteger(Number(listing))))||
    (seller!==null&&!/^[a-f0-9-]{36}$/i.test(seller)))return fail('Contato inválido.',400);
  const db=env.MARKETPLACE_DB;
  if(!db)return fail('Contato temporariamente indisponível.',503);
  try{
    const contact=listing!==null?
      await db.prepare(`SELECT s.whatsapp,l.title FROM marketplace_listings l JOIN marketplace_sellers s ON s.id=l.seller_id
        WHERE l.id=? AND l.status='published' AND s.status!='suspended' AND s.verified_whatsapp=s.whatsapp`).bind(Number(listing)).first():
      await db.prepare(`SELECT whatsapp FROM marketplace_sellers WHERE id=? AND status!='suspended' AND profile_contact=1
        AND verified_whatsapp=whatsapp`).bind(seller).first();
    if(typeof contact?.whatsapp!=='string'||!/^55\d{10,11}$/.test(contact.whatsapp))
      return fail('Este contato está indisponível. Volte à vitrine para ver as ofertas atuais.',404);
    const destination=new URL('https://wa.me/'+contact.whatsapp);
    const message=listing!==null?'Olá! Tenho interesse no anúncio '+contact.title+' que vi no VENDE+. '+url.origin+'/#anuncio-'+listing:
      'Olá! Encontrei sua vitrine no VENDE+ e gostaria de conversar sobre seus anúncios.';
    destination.searchParams.set('text',message);
    return new Response(null,{status:302,headers:{...headers,Location:destination.href}});
  }catch{return fail('Contato temporariamente indisponível.',503)}
}
