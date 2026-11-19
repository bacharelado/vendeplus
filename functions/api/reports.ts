import {readJson,RequestFailure} from '../_shared/http.ts';
import {reportFields,reporterForToday,type ReportDB} from '../_shared/report-intake.ts';
export async function onRequest({request,env}:{request:Request;env:{MARKETPLACE_DB?:ReportDB}}){
 if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST'}});
 if(!env.MARKETPLACE_DB)return Response.json({error:'Indisponível'},{status:503});
 try{
  const data=await readJson(request,2048);
  const listingId=data.listingId,{reason,details}=reportFields(data,'listing');
  if(!Number.isSafeInteger(listingId)||Number(listingId)<=0)throw new RequestFailure('Anúncio inválido.');
  const db=env.MARKETPLACE_DB;
  const listing=await db.prepare("SELECT l.id FROM marketplace_listings l JOIN marketplace_sellers s ON s.id=l.seller_id WHERE l.id=? AND l.status='published' AND s.status!='suspended'").bind(listingId).first();
  if(!listing)return Response.json({error:'Anúncio indisponível'},{status:404});
  const hashed=await reporterForToday(db,request);
  await db.prepare("INSERT OR IGNORE INTO marketplace_reports(listing_id,reporter_hash,reason,details) VALUES (?,?,?,?)").bind(listingId,hashed,reason,details).run();
  return Response.json({ok:true},{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(error){return error instanceof RequestFailure?Response.json({error:error.message},{status:error.status}):Response.json({error:'Não foi possível registrar a denúncia'},{status:503})}
}
