type DB={prepare:(sql:string)=>{bind:(...args:unknown[])=>{first:()=>Promise<Record<string,unknown>|null>;all:()=>Promise<{results:Record<string,unknown>[]}>}}};
export async function onRequest({request,env}:{request:Request;env:{MARKETPLACE_DB?:DB}}){
 if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
 if(!env.MARKETPLACE_DB)return Response.json({error:'Indisponível'},{status:503});
 const id=new URL(request.url).pathname.replace(/^\/api\/sellers\//,'').replace(/\/$/,'');
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))return Response.json({error:'Perfil inválido'},{status:400});
 try{
  const db=env.MARKETPLACE_DB;
  const seller=await db.prepare("SELECT s.id,s.display_name AS name,a.neighborhood,COALESCE(p.bio,'') AS bio FROM marketplace_sellers s JOIN marketplace_accounts a ON a.id=s.id LEFT JOIN marketplace_seller_profiles p ON p.seller_id=s.id WHERE s.id=? AND s.status!='suspended'").bind(id).first();
  if(!seller)return Response.json({error:'Perfil indisponível'},{status:404});
  const listings=await db.prepare("SELECT l.id,l.title,l.price_cents AS priceCents,l.category,l.condition,l.image_url AS image,l.description,l.fulfillment,l.created_at AS createdAt,s.display_name AS seller,s.id AS sellerId,d.neighborhood,s.whatsapp AS contactWhatsapp,'PUBLICADO' AS status FROM marketplace_listings l JOIN marketplace_sellers s ON s.id=l.seller_id LEFT JOIN marketplace_listing_details d ON d.listing_id=l.id WHERE l.seller_id=? AND l.status='published' ORDER BY l.created_at DESC LIMIT 100").bind(id).all();
  return Response.json({seller,listings:listings.results},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return Response.json({error:'Perfil indisponível'},{status:503})}
}
