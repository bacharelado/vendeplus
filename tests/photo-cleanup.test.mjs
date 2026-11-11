import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './helpers/database.mjs';
import {handleAccount} from '../functions/_shared/account.ts';
const origin='https://preview.vendeplus.pages.dev';
const image=origin+'/api/media/c-123e4567-e89b-12d3-a456-426614174000.png';
test('remoção esconde o anúncio e exclui somente sua imagem autenticada',async()=>{
 const {db,sqlite}=database();
 const env={MARKETPLACE_DB:db,CLOUDINARY_CLOUD_NAME:'qa-test',CLOUDINARY_API_KEY:'123',CLOUDINARY_API_SECRET:'qa-secret'};
 const request=(path,body,cookie='')=>handleAccount({env,request:new Request(origin+'/api/account/'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)})});
 const response=await request('register',{name:'TESTE APOCALYPTIC',email:'cleanup@example.invalid',password:'ExclusiveTest!2026',whatsapp:'5592000000000',neighborhood:'Poranga II',acceptContact:true});
 const {account}=await response.json(),cookie=response.headers.get('Set-Cookie').split(';')[0];
 sqlite.prepare("INSERT INTO marketplace_listings(id,seller_id,title,description,price_cents,category,condition,fulfillment,status,image_url) VALUES(1,?,'Teste de limpeza','Exclusivamente teste',100,'Casa','Novo','Sem entrega','published',?)").run(account.id,image);
 const original=globalThis.fetch;
 let deleted=0;
 try{
  globalThis.fetch=async(url,options)=>{
   assert.equal(sqlite.prepare('SELECT status FROM marketplace_listings WHERE id=1').get().status,'removed');
   assert.equal(options.body.get('type'),'authenticated');
   assert.equal(options.body.get('public_id'),'vendeplus/123e4567-e89b-12d3-a456-426614174000');
   deleted++;
   return Response.json({result:'ok'});
  };
  const removed=await handleAccount({env,request:new Request(origin+'/api/account/listings/1',{method:'PATCH',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({status:'removed'})})});
  assert.equal(removed.status,200);assert.deepEqual(await removed.json(),{ok:true});assert.equal(deleted,1);
 }finally{globalThis.fetch=original;sqlite.close()}
});
