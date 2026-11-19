import {session,type Database} from '../../_shared/account.ts';
import {managedPhotoKey} from '../../_shared/photo-cleanup.ts';
import {cloudinaryKey,cloudinaryReady,readCloudinary,type CloudinaryEnv} from '../../_shared/cloudinary.ts';

type Bucket={get:(key:string)=>Promise<{body:ReadableStream;httpMetadata?:{contentType?:string}}|null>};
type Env=CloudinaryEnv&{MARKETPLACE_DB?:Database;LISTING_IMAGES?:Bucket};
export async function onRequest({request,env}:{request:Request;env:Env}){
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
 if(!env.MARKETPLACE_DB)return new Response(null,{status:503});
 const url=new URL(request.url),db=env.MARKETPLACE_DB;
 let key=url.pathname.replace('/api/media/','');
 try{
  const owner=/^owner-([1-9]\d*)$/.exec(key);
  if(owner){
   const user=await session(db,request);
   if(!user)return new Response(null,{status:401});
   const listing=await db.prepare("SELECT image_url FROM marketplace_listings WHERE id=? AND seller_id=? AND status!='removed'").bind(Number(owner[1]),user.id).first();
   key=managedPhotoKey(listing?.image_url,url.origin)||'';
  }
  if(!/^(?:c-)?[a-f0-9-]{36}\.(?:png|webp)$/.test(key))return new Response(null,{status:404});
  if(!owner){
   const fileUrl=new URL('/api/media/'+key,request.url).href;
   const listing=await db.prepare("SELECT l.id FROM marketplace_listings l JOIN marketplace_sellers s ON s.id=l.seller_id WHERE l.image_url=? AND l.status='published' AND s.status!='suspended'").bind(fileUrl).first();
   if(!listing)return new Response(null,{status:404});
  }
  if(cloudinaryKey(key)?!cloudinaryReady(env):!env.LISTING_IMAGES)return new Response(null,{status:503});
  const headers={'Content-Type':key.endsWith('.png')?'image/png':'image/webp','X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'};
  if(cloudinaryKey(key)){
   const response=await readCloudinary(env,key,request.method as 'GET'|'HEAD');
   if(!response.ok)return new Response(null,{status:response.status===404?404:503});
   if(response.headers.get('Content-Type')?.split(';')[0]!=='image/png')return new Response(null,{status:503});
   return new Response(request.method==='HEAD'?null:response.body,{headers});
  }
  const object=await env.LISTING_IMAGES!.get(key);
  if(!object)return new Response(null,{status:404});
  return new Response(request.method==='HEAD'?null:object.body,{headers});
 }catch{return new Response(null,{status:503})}
}
