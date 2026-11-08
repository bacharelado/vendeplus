import {session,type Database} from '../_shared/account.ts';
type Bucket={put:(key:string,body:ArrayBuffer,metadata:{httpMetadata:{contentType:string}})=>Promise<unknown>};
type Env={MARKETPLACE_DB?:Database;LISTING_IMAGES?:Bucket};
export async function onRequest({request,env}:{request:Request;env:Env}){
 if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST'}});
 if(!env.MARKETPLACE_DB||!env.LISTING_IMAGES)return Response.json({error:'Armazenamento de imagens não configurado'},{status:503});
 if(request.headers.get('Origin')!==new URL(request.url).origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return Response.json({error:'Origem inválida'},{status:403});
 const type=request.headers.get('Content-Type')||'';
 if(!['image/png','image/webp'].includes(type))return Response.json({error:'Envie PNG ou WebP'},{status:415});
 if(Number(request.headers.get('Content-Length')||0)>3145728)return Response.json({error:'Imagem acima do limite de 3 MB'},{status:413});
 const id=Number(new URL(request.url).searchParams.get('listingId'));
 if(!Number.isSafeInteger(id)||id<=0)return Response.json({error:'Anúncio inválido'},{status:400});
 const db=env.MARKETPLACE_DB;
 try{
  const user=await session(db,request);
  if(!user)return Response.json({error:'Faça login'},{status:401});
  const listing=await db.prepare("SELECT id,image_url AS image FROM marketplace_listings WHERE id=? AND seller_id=? AND status NOT IN ('removed','rejected')").bind(id,user.id).first();
  if(!listing)return Response.json({error:'Anúncio não encontrado'},{status:404});
  const reader=request.body?.getReader();
  if(!reader)return Response.json({error:'Arquivo ausente'},{status:400});
  const chunks:Uint8Array[]=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>3145728){await reader.cancel();return Response.json({error:'Imagem muito grande'},{status:413})}chunks.push(value)}
  if(size<16)return Response.json({error:'Imagem inválida'},{status:400});
  const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length}
  const png=data[0]===137&&data[1]===80&&data[2]===78&&data[3]===71&&data[4]===13&&data[5]===10&&data[6]===26&&data[7]===10;
  const webp=String.fromCharCode(...data.slice(0,4))==='RIFF'&&String.fromCharCode(...data.slice(8,12))==='WEBP';
  if((type==='image/png'&&!png)||(type==='image/webp'&&!webp))return Response.json({error:'Formato de imagem inválido'},{status:415});
  const key=crypto.randomUUID()+(png?'.png':'.webp');
  await env.LISTING_IMAGES.put(key,data.buffer,{httpMetadata:{contentType:type}});
  const image=new URL('/api/media/'+key,request.url).href;
  const update=await db.prepare("UPDATE marketplace_listings SET image_url=? WHERE id=? AND seller_id=? AND status NOT IN ('removed','rejected')").bind(image,id,user.id).run();
  if(!update.meta.changes)return Response.json({error:'Anúncio não encontrado'},{status:404});
  return Response.json({ok:true,image},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Não foi possível salvar a foto'},{status:503})}
}
