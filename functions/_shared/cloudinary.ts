
import {createHash} from 'node:crypto';

export type CloudinaryEnv={
 CLOUDINARY_CLOUD_NAME?:string;
 CLOUDINARY_API_KEY?:string;
 CLOUDINARY_API_SECRET?:string;
};

const keyPattern=/^c-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.png$/;
const cloudPattern=/^[a-z0-9_-]{1,100}$/i;
const idFromKey=(key:string)=>'vendeplus/'+key.slice(2,-4);
const signature=(params:Record<string,string>,secret:string)=>createHash('sha1').update(Object.entries(params).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('&')+secret).digest('hex');

export function cloudinaryReady(env:CloudinaryEnv){
 return cloudPattern.test(env.CLOUDINARY_CLOUD_NAME?.trim()||'')&&/^[0-9]+$/.test(env.CLOUDINARY_API_KEY?.trim()||'')&&!!env.CLOUDINARY_API_SECRET?.trim();
}

export function cloudinaryKey(key:string){
 return keyPattern.test(key);
}

function credentials(env:CloudinaryEnv){
 if(!cloudinaryReady(env))throw new Error('Armazenamento de fotos não configurado.');
 return {
  name:env.CLOUDINARY_CLOUD_NAME!.trim(),
  apiKey:env.CLOUDINARY_API_KEY!.trim(),
  secret:env.CLOUDINARY_API_SECRET!.trim()
 };
}

function signedForm(params:Record<string,string>,apiKey:string,secret:string){
 const form=new FormData();
 for(const [key,value] of Object.entries(params))form.set(key,value);
 form.set('api_key',apiKey);
 form.set('signature',signature(params,secret));
 return form;
}

export async function uploadCloudinary(env:CloudinaryEnv,key:string,bytes:Uint8Array){
 if(!cloudinaryKey(key)||bytes.length>3145728||!bytes.length)throw new Error('Foto inválida.');

 const {name,apiKey,secret}=credentials(env);
 const params={
  overwrite:'false',
  public_id:idFromKey(key),
  timestamp:String(Math.floor(Date.now()/1000))
 };

 const form=signedForm(params,apiKey,secret);
 const copy=new Uint8Array(bytes.length);
 copy.set(bytes);

 form.set('file',new Blob([copy.buffer],{type:'image/png'}),'photo.png');

 const response=await fetch('https://api.cloudinary.com/v1_1/'+name+'/image/authenticated',{
  method:'POST',
  body:form,
  signal:AbortSignal.timeout(20000)
 });

 if(!response.ok){
  console.error('CLOUDINARY_UPLOAD_HTTP_STATUS',response.status);
  throw new Error('Cloudinary recusou a fotografia.');
 }

 const result=await response.json() as Record<string,unknown>;

 if(result.public_id!==params.public_id||result.type!=='authenticated'||result.resource_type!=='image'||result.format!=='png'){
  throw new Error('Resposta inesperada do armazenamento.');
 }
}

export async function deleteCloudinary(env:CloudinaryEnv,key:string){
 if(!cloudinaryKey(key))throw new Error('Identificador inválido.');

 const {name,apiKey,secret}=credentials(env);

 const params={
  invalidate:'true',
  public_id:idFromKey(key),
  timestamp:String(Math.floor(Date.now()/1000)),
  type:'authenticated'
 };

 const response=await fetch('https://api.cloudinary.com/v1_1/'+name+'/image/destroy',{
  method:'POST',
  body:signedForm(params,apiKey,secret),
  signal:AbortSignal.timeout(12000)
 });

 if(!response.ok)throw new Error('Não foi possível remover a foto antiga.');

 const result=await response.json() as Record<string,unknown>;

 if(!['ok','not found'].includes(String(result.result))){
  throw new Error('Falha ao confirmar a exclusão.');
 }
}

export async function readCloudinary(env:CloudinaryEnv,key:string,method:'GET'|'HEAD'){
 if(!cloudinaryKey(key))throw new Error('Identificador inválido.');

 const {name,secret}=credentials(env);
 const path='v1/'+idFromKey(key)+'.png';
 const token=createHash('sha1').update(path+secret).digest('base64url').slice(0,8);

 return fetch('https://res.cloudinary.com/'+name+'/image/authenticated/s--'+token+'--/'+path,{
  method,
  signal:AbortSignal.timeout(12000)
 });
}
