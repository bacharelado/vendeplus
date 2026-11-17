import {createHash} from 'node:crypto';

type Row=Record<string,unknown>;
type Statement={bind:(...args:unknown[])=>Statement;first:()=>Promise<Row|null>;all:()=>Promise<{results:Row[]}>;run:()=>Promise<{meta:{changes:number}}>} ;
type DB={prepare:(sql:string)=>Statement};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const slug=/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');

export async function onRequest({request,env}:{request:Request;env:{MARKETPLACE_DB?:DB}}){
 if(!['GET','POST'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, POST'}});
 if(!env.MARKETPLACE_DB)return json({error:'Indisponível'},503);
 const raw=decodeURIComponent(new URL(request.url).pathname.replace(/^\/api\/sellers\//,'').replace(/\/$/,''));
 const report=/^([^/]+)\/report$/.exec(raw);
 const key=(report?.[1]||raw).toLowerCase();
 if(!uuid.test(key)&&!slug.test(key))return json({error:'Perfil inválido'},400);
 try{
  const db=env.MARKETPLACE_DB;
  const seller=await db.prepare(`SELECT s.id,s.display_name AS name,a.neighborhood,a.created_at AS createdAt,
    COALESCE(p.bio,'') AS bio,p.slug,COALESCE(p.seller_type,'person') AS sellerType,
    COALESCE(p.business_name,'') AS businessName,p.avatar_url AS avatarUrl,p.cover_url AS coverUrl,
    s.whatsapp AS contactWhatsapp
    FROM marketplace_sellers s JOIN marketplace_accounts a ON a.id=s.id
    LEFT JOIN marketplace_seller_profiles p ON p.seller_id=s.id
    WHERE (s.id=? OR lower(p.slug)=?) AND s.status!='suspended' LIMIT 1`).bind(key,key).first();
  if(!seller)return json({error:'Perfil indisponível'},404);

  if(report&&request.method==='POST'){
   const type=request.headers.get('Content-Type')||'';
   if(!type.toLowerCase().startsWith('application/json'))return json({error:'Envie os dados em JSON.'},415);
   const data=await request.json() as Record<string,unknown>;
   const reason=typeof data.reason==='string'?data.reason:'',details=typeof data.details==='string'?data.details.trim():'';
   if(!['spam','fraud','impersonation','prohibited','other'].includes(reason)||details.length>500)return json({error:'Denúncia inválida.'},400);
   const ip=request.headers.get('CF-Connecting-IP')||'unknown';
   try{await db.prepare('INSERT INTO marketplace_seller_reports(seller_id,reporter_hash,reason,details) VALUES (?,?,?,?)').bind(seller.id,hash(ip),reason,details).run()}
   catch{return json({error:'Esta denúncia já foi recebida.'},409)}
   return json({ok:true},201);
  }
  if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
  const listings=await db.prepare(`SELECT l.id,l.title,l.price_cents AS priceCents,l.category,l.condition,l.image_url AS image,l.description,l.fulfillment,l.created_at AS createdAt,
    s.display_name AS seller,s.id AS sellerId,d.neighborhood,s.whatsapp AS contactWhatsapp,'PUBLICADO' AS status
    FROM marketplace_listings l JOIN marketplace_sellers s ON s.id=l.seller_id
    LEFT JOIN marketplace_listing_details d ON d.listing_id=l.id
    WHERE l.seller_id=? AND l.status='published' AND s.status!='suspended'
    ORDER BY l.created_at DESC LIMIT 100`).bind(seller.id).all();
  return json({seller:{...seller,activeListings:listings.results.length},listings:listings.results});
 }catch{return json({error:'Perfil indisponível'},503)}
}