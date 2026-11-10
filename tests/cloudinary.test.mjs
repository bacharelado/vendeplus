import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cloudinaryKey,cloudinaryReady,deleteCloudinary,readCloudinary,uploadCloudinary} from '../functions/_shared/cloudinary.ts';

const env={CLOUDINARY_CLOUD_NAME:'vendeplus-test',CLOUDINARY_API_KEY:'123456',CLOUDINARY_API_SECRET:'secret-test-only'};
const key='c-123e4567-e89b-12d3-a456-426614174000.png';
const publicId='vendeplus/123e4567-e89b-12d3-a456-426614174000';
const sha=params=>createHash('sha1').update(Object.entries(params).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('&')+env.CLOUDINARY_API_SECRET).digest('hex');

test('Cloudinary só fica disponível com credenciais de servidor completas',()=>{
 assert.equal(cloudinaryReady({}),false);
 assert.equal(cloudinaryReady({...env,CLOUDINARY_API_SECRET:undefined}),false);
 assert.equal(cloudinaryReady({...env,CLOUDINARY_CLOUD_NAME:'evil.example/'}),false);
 assert.equal(cloudinaryReady(env),true);
 assert.equal(cloudinaryReady({...env,CLOUDINARY_API_KEY:' 123456\n',CLOUDINARY_CLOUD_NAME:' vendeplus-test ',CLOUDINARY_API_SECRET:' secret-test-only\n'}),true);
 assert.equal(cloudinaryKey(key),true);
 assert.equal(cloudinaryKey('../123.png'),false);
});

test('upload autenticado usa assinatura e nunca inclui segredo no formulário',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async(url,options)=>{
   assert.equal(url,'https://api.cloudinary.com/v1_1/vendeplus-test/image/authenticated');
   assert.equal(options.method,'POST');
   const form=options.body;
   assert.equal(form.get('public_id'),publicId);
   assert.equal(form.get('overwrite'),'false');
   assert.equal(form.get('api_key'),env.CLOUDINARY_API_KEY);
   assert.equal(form.get('signature'),sha({overwrite:'false',public_id:publicId,timestamp:form.get('timestamp')}));
   assert.equal(form.has('api_secret'),false);
   assert.equal(form.get('file').type,'image/png');
   return Response.json({public_id:publicId,type:'authenticated',format:'png',resource_type:'image'});
  };
  await uploadCloudinary(env,key,new Uint8Array([137,80,78,71]));
 }finally{globalThis.fetch=original}
});

test('leitura do armazenamento usa URL assinada somente no servidor',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async(url,options)=>{
   const path='v1/'+publicId+'.png';
   const signature=createHash('sha1').update(path+env.CLOUDINARY_API_SECRET).digest('base64url').slice(0,8);
   assert.equal(url,'https://res.cloudinary.com/vendeplus-test/image/authenticated/s--'+signature+'--/'+path);
   assert.equal(options.method,'HEAD');
   return new Response(null,{status:200,headers:{'Content-Type':'image/png'}});
  };
  const result=await readCloudinary(env,key,'HEAD');
  assert.equal(result.status,200);
 }finally{globalThis.fetch=original}
});

test('exclusão autenticada usa tipo correto e assinatura',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async(url,options)=>{
   assert.equal(url,'https://api.cloudinary.com/v1_1/vendeplus-test/image/destroy');
   const form=options.body;
   assert.equal(form.get('type'),'authenticated');
   assert.equal(form.get('public_id'),publicId);
   assert.equal(form.get('signature'),sha({invalidate:'true',public_id:publicId,timestamp:form.get('timestamp'),type:'authenticated'}));
   return Response.json({result:'ok'});
  };
  await deleteCloudinary(env,key);
 }finally{globalThis.fetch=original}
});
