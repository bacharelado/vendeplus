import {cloudinaryKey,deleteCloudinary,type CloudinaryEnv} from './cloudinary.ts';
import type {Database} from './account.ts';
export type PhotoEnv=CloudinaryEnv&{LISTING_IMAGES?:{delete:(key:string)=>Promise<unknown>}};
export function managedPhotoKey(image:unknown,origin:string){
 if(typeof image!=='string')return null;
 try{
  const url=new URL(image),site=new URL(origin);
  // Immutable Pages preview hostnames share the preview binding only.
  const preview=(host:string)=>/^[-a-z0-9]+\.vendeplus\.pages\.dev$/.test(host);
  if(url.origin!==origin&&!(url.protocol==='https:'&&!url.port&&preview(url.hostname)&&preview(site.hostname)))return null;
  if(url.username||url.password||url.search||url.hash)return null;
  return /^\/api\/media\/((?:c-)?[a-f0-9-]{36}\.(?:png|webp))$/.exec(url.pathname)?.[1]||null;
 }catch{return null}
}
export async function removeListingPhoto(db:Database,env:PhotoEnv,image:unknown,origin:string,id:number){
 const key=managedPhotoKey(image,origin);
 if(!key)return;
 // Do not remove an asset still referenced by any other listing.
 if(await db.prepare('SELECT id FROM marketplace_listings WHERE substr(image_url,-length(?))=? AND id!=?').bind('/'+key,'/'+key,id).first())return;
 if(cloudinaryKey(key))await deleteCloudinary(env,key);
 else if(env.LISTING_IMAGES)await env.LISTING_IMAGES.delete(key);
 else throw Error('Armazenamento da foto indisponível.');
}
