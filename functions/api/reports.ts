import {createHash} from 'node:crypto';
import {readJson,RequestFailure} from '../_shared/http.ts';
type DB={prepare:(sql:string)=>{bind:(...args:unknown[])=>{first:()=>Promise<Record<string,unknown>|null>;run:()=>Promise<unknown>}}};
export async function onRequest({request,env}:{request:Request;env:{MARKETPLACE_DB?:DB}}){
 if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST'}});
 if(!env.MARKETPLACE_DB)return Response.json({error:'Indisponível'},{status:503});
 try{
  const data=await readJson(request,2048);
  const listingId=data.listingId,reason=data.reason,details=typeof data.details==='string'?data.details.trim():'';
  if(!Number.isSafeInteger(listingId)||Number(listingId)<=0||typeof reason!=='string'||!['spam','fraud','prohibited','other'].includes(reason)||(data.details!==undefined&&typeof data.details!=='string')||details.length>500)return Response.json({error:'Dados inválidos'},{status:400});
  const db=env.MARKETPLACE_DB;
  const listing=await db.prepare("SELECT l.id FROM marketplace_listings l JOIN marketplace_sellers s ON s.id=l.seller_id WHERE l.id=? AND l.status='published' AND s.status!='suspended'").bind(listingId).first();
  if(!listing)return Response.json({error:'Anúncio indisponível'},{status:404});
  const now=Math.floor(Date.now()/1000);
  const ip=request.headers.get('CF-Connecting-IP')||'unknown';
  const hashed=createHash('sha256').update(ip+':'+Math.floor(Date.now()/86400000)).digest('hex');
  const rate=await db.prepare("INSERT INTO marketplace_rate_limits(key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING attempts").bind(createHash('sha256').update('reports:'+hashed).digest('hex'),now+86400,now,now).first();
  if(Number(rate?.attempts)>10)return Response.json({error:'Limite de denúncias atingido'},{status:429});
  await db.prepare("INSERT OR IGNORE INTO marketplace_reports(listing_id,reporter_hash,reason,details) VALUES (?,?,?,?)").bind(listingId,hashed,reason,details).run();
  return Response.json({ok:true},{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(error){return error instanceof RequestFailure?Response.json({error:error.message},{status:error.status}):Response.json({error:'Não foi possível registrar a denúncia'},{status:503})}
}
