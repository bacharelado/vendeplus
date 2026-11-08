import {catalogQuery} from '../_shared/catalog-query.ts';

type Statement={bind:(...values:unknown[])=>Statement;all:()=>Promise<{success:boolean;results?:Record<string,unknown>[]}>};
type Database={prepare:(query:string)=>Statement};
type Context={request:Request;env:{MARKETPLACE_DB?:Database}};
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const respond=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
export async function onRequest({request,env}:Context){
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
  if(!env.MARKETPLACE_DB)return respond({error:'CATALOG_UNAVAILABLE'},503);
  try{
    const url=new URL(request.url),id=url.searchParams.get('id'),before=url.searchParams.get('before');
    let query=catalogQuery,values:unknown[]=[];
    if(id!==null){
      if(!/^[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id)))return respond({error:'INVALID_ID'},400);
      query=query.replace("WHERE l.status=", "WHERE l.id=? AND l.status=");values=[Number(id)];
    }else if(before!==null){
      if(!/^\d+:[1-9]\d*$/.test(before))return respond({error:'INVALID_CURSOR'},400);
      const [time,key]=before.split(':').map(Number);
      if(!Number.isSafeInteger(time)||!Number.isSafeInteger(key))return respond({error:'INVALID_CURSOR'},400);
      query=query.replace("WHERE l.status=", "WHERE (l.created_at<? OR (l.created_at=? AND l.id<?)) AND l.status=");values=[time,time,key];
    }
    const statement=env.MARKETPLACE_DB.prepare(query);
    const result=await (values.length?statement.bind(...values):statement).all();
    if(!result.success||!Array.isArray(result.results))return respond({error:'CATALOG_UNAVAILABLE'},503);
    const listings=result.results.map(row=>({
      id:row.id,title:row.title,description:row.description,priceCents:row.priceCents,
      category:row.category,condition:row.condition,image:row.image,fulfillment:row.fulfillment,
      seller:row.seller,sellerId:row.sellerId,neighborhood:row.neighborhood,contactWhatsapp:typeof row.contactWhatsapp==='string'&&/^55\d{10,11}$/.test(row.contactWhatsapp)?row.contactWhatsapp:undefined,
      createdAt:row.createdAt,status:'PUBLICADO'
    }));
    const last=listings.at(-1);
    const nextCursor=id===null&&listings.length===200&&last?String(last.createdAt)+':'+String(last.id):undefined;
    return request.method==='HEAD'?new Response(null,{headers}):respond({listings,...(nextCursor?{nextCursor}:{})});
  }catch{return respond({error:'CATALOG_UNAVAILABLE'},503)}
}
