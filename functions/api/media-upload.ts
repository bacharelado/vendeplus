import {createHash} from 'node:crypto';
import {session,type Database} from '../_shared/account.ts';
import {cleanPhoto} from '../_shared/image.ts';
import {cloudinaryKey,cloudinaryReady,deleteCloudinary,uploadCloudinary,type CloudinaryEnv} from '../_shared/cloudinary.ts';
type Bucket={put:(key:string,body:Uint8Array,metadata:{httpMetadata:{contentType:string}})=>Promise<unknown>;delete:(key:string)=>Promise<unknown>};
type Env=CloudinaryEnv&{MARKETPLACE_DB?:Database;LISTING_IMAGES?:Bucket};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function ownedKey(value:unknown,origin:string){
 if(typeof value!=='string')return null;
 try{const url=new URL(value);return url.origin===origin&&/^\/api\/media\/(?:c-)?[a-f0-9-]{36}\.(png|webp)$/.test(url.pathname)&&!url.search&&!url.hash?url.pathname.slice('/api/media/'.length):null}catch{return null}
}
export async function onRequest({request,env}:{request:Request;env:Env}){
 if(request.method==='GET')return json({available:!!env.MARKETPLACE_DB&&(!!env.LISTING_IMAGES||cloudinaryReady(env))});
 if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'GET, POST'}});
 if(!env.MARKETPLACE_DB&&request.method==='POST')return json({error:'O banco de dados está indisponível.'},503);
 if(!env.MARKETPLACE_DB||(!env.LISTING_IMAGES&&!cloudinaryReady(env)))return json({error:'Não foi possível salvar fotos agora. Tente mais tarde.'},503);
 const origin=new URL(request.url).origin;
 if(request.headers.get('Origin')!==origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'Abra o site novamente e tente enviar a foto.'},403);
 if(request.headers.get('Content-Type')!=='image/png')return json({error:'Escolha a foto novamente pelo formulário.'},415);
 if(Number(request.headers.get('Content-Length')||0)>3145728)return json({error:'Foto muito grande. Escolha uma imagem menor.'},413);
 const id=Number(new URL(request.url).searchParams.get('listingId'));
 if(!Number.isSafeInteger(id)||id<=0)return json({error:'Anúncio inválido.'},400);
 const db=env.MARKETPLACE_DB,bucket=env.LISTING_IMAGES,useCloudinary=cloudinaryReady(env);
 const remove=async(key:string)=>{if(cloudinaryKey(key))await deleteCloudinary(env,key);else if(bucket)await bucket.delete(key);else throw new Error('Armazenamento anterior indisponível.')};
 try{
  const user=await session(db,request);
  if(!user)return json({error:'Entre na sua conta para enviar a foto.'},401);
  const listing=await db.prepare("SELECT id,image_url AS image FROM marketplace_listings WHERE id=? AND seller_id=? AND status NOT IN ('removed','rejected')").bind(id,user.id).first();
  if(!listing)return json({error:'Anúncio não encontrado.'},404);
  const now=Math.floor(Date.now()/1000),rateKey=createHash('sha256').update('upload:'+user.id).digest('hex');
  const quota=await db.prepare('INSERT INTO marketplace_rate_limits(key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING attempts').bind(rateKey,now+900,now,now).first();
  if(Number(quota?.attempts)>10)return json({error:'Você enviou muitas fotos. Aguarde 15 minutos e tente novamente.'},429);
  const reader=request.body?.getReader();if(!reader)return json({error:'Escolha uma foto.'},400);
  const chunks:Uint8Array[]=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>3145728){await reader.cancel();return json({error:'Foto muito grande. Escolha uma imagem menor.'},413)}chunks.push(value)}
  const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length}
  let imageData:Uint8Array;try{imageData=cleanPhoto(data)}catch{return json({error:'Não foi possível abrir esta foto. Escolha outra imagem.'},415)}
  if(useCloudinary){
   const allowed=async(label:string,limit:number,ttl:number)=>{
    const key=createHash('sha256').update('cloudinary:'+label).digest('hex');
    const result=await db.prepare('INSERT INTO marketplace_rate_limits(key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING attempts').bind(key,now+ttl,now,now).first();
    return Number(result?.attempts)<=limit;
   };
   if(!await allowed('global',200,2592000)||!await allowed('seller:'+user.id,15,2592000))return json({error:'Limite de fotos do piloto atingido. Contate a administração.'},429);
  }
  const key=(useCloudinary?'c-':'')+crypto.randomUUID()+'.png',image=new URL('/api/media/'+key,request.url).href;
  if(useCloudinary)await uploadCloudinary(env,key,imageData);
  else await bucket!.put(key,imageData,{httpMetadata:{contentType:'image/png'}});
  // Compare the previous image as well as ownership: concurrent edits must not
  // overwrite one another and leave an unreferenced object behind.
  let changed=false;
  try{
   const result=await db.prepare("UPDATE marketplace_listings SET image_url=? WHERE id=? AND seller_id=? AND image_url IS ? AND status NOT IN ('removed','rejected')").bind(image,id,user.id,listing.image??null).run();
   changed=!!result.meta.changes;
  }catch{
   const referenced=await db.prepare('SELECT id FROM marketplace_listings WHERE image_url=?').bind(image).first();
   if(!referenced)await remove(key);
   return json({error:'Não foi possível confirmar a foto. Atualize seus anúncios antes de tentar novamente.'},503);
  }
  if(!changed){await remove(key);return json({error:'O anúncio mudou. Atualize a página e tente novamente.'},409)}
  const previous=ownedKey(listing.image,origin);
  if(previous){
   const referenced=await db.prepare('SELECT id FROM marketplace_listings WHERE image_url=?').bind(listing.image).first();
   if(!referenced){try{await remove(previous)}catch{return json({ok:true,image,warning:'Foto salva. A limpeza da foto anterior está pendente.'})}}
  }
  return json({ok:true,image});
 }catch{return json({error:'Não foi possível salvar a foto. Tente novamente.'},503)}
}
