import {cloudinaryKey,deleteCloudinary,type CloudinaryEnv} from './cloudinary.ts';
import type {Database} from './account.ts';
export type PhotoEnv=CloudinaryEnv&{LISTING_IMAGES?:{delete:(key:string)=>Promise<unknown>}};
export async function removeListingPhoto(db:Database,env:PhotoEnv,image:unknown,origin:string,id:number){
 if(typeof image!=='string'||!image)return;
 const url=new URL(image);
 if(url.origin!==origin||url.search||url.hash)return;
 const key=url.pathname.replace(/^\/api\/media\//,'');
 if(!/^(?:c-)?[a-f0-9-]{36}\.(png|webp)$/.test(key))return;
 // Do not remove an asset still referenced by any other listing.
 if(await db.prepare('SELECT id FROM marketplace_listings WHERE image_url=? AND id!=?').bind(image,id).first())return;
 if(cloudinaryKey(key))await deleteCloudinary(env,key);
 else if(env.LISTING_IMAGES)await env.LISTING_IMAGES.delete(key);
 else throw Error('Armazenamento da foto indisponível.');
}
