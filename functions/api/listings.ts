import {catalogQuery} from '../_shared/catalog-query.ts';

type Database={prepare:(query:string)=>{all:()=>Promise<{success:boolean;results?:Record<string,unknown>[]}>}};
type Context={request:Request;env:{MARKETPLACE_DB?:Database}};
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const respond=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
export async function onRequest({request,env}:Context){
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
  if(!env.MARKETPLACE_DB)return respond({error:'CATALOG_UNAVAILABLE'},503);
  try{
    const result=await env.MARKETPLACE_DB.prepare(catalogQuery).all();
    if(!result.success||!Array.isArray(result.results))return respond({error:'CATALOG_UNAVAILABLE'},503);
    const listings=result.results.map(row=>({
      id:row.id,title:row.title,description:row.description,priceCents:row.priceCents,
      category:row.category,condition:row.condition,image:row.image,fulfillment:row.fulfillment,
      seller:row.seller,contactWhatsapp:typeof row.contactWhatsapp==='string'&&/^55\d{10,11}$/.test(row.contactWhatsapp)?row.contactWhatsapp:undefined,
      createdAt:row.createdAt,status:'PUBLICADO'
    }));
    return request.method==='HEAD'?new Response(null,{headers}):respond({listings});
  }catch{return respond({error:'CATALOG_UNAVAILABLE'},503)}
}
