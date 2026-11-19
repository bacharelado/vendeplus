import {onRequest as readMedia} from '../functions/api/media/[[path]].ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
import {database} from './helpers/database.mjs';
import {handleAccount} from '../functions/_shared/account.ts';
import {onRequest} from '../functions/api/media-upload.ts';
import {cleanPhoto} from '../functions/_shared/image.ts';
const origin='https://preview.vendeplus.pages.dev';
const valid=()=>PNG.sync.write({width:8,height:8,data:Buffer.alloc(8*8*4,255)});
async function setup(){
 const h=database();
 const response=await handleAccount({request:new Request(origin+'/api/account/register',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Teste foto',email:'photo@example.invalid',password:'Teste#2026',whatsapp:'5592999999999',neighborhood:'Poranga II',acceptContact:true})}),env:{MARKETPLACE_DB:h.db}});
 const account=(await response.json()).account,cookie=response.headers.get('Set-Cookie').split(';')[0];
 h.sqlite.prepare("INSERT INTO marketplace_listings(id,seller_id,title,description,price_cents,category,condition,fulfillment,status) VALUES (1,?,'Mesa de teste','Descrição de teste',1000,'Casa','Novo','Retirada','published')").run(account.id);
 const objects=new Map();const deleted=[];
 const bucket={async put(key,bytes){objects.set(key,bytes)},async delete(key){objects.delete(key);deleted.push(key)}};
 const upload=(bytes=valid(),extra={})=>onRequest({request:new Request(origin+'/api/media-upload?listingId=1',{method:'POST',headers:{Origin:origin,'Content-Type':'image/png',Cookie:cookie,...extra},body:bytes}),env:{MARKETPLACE_DB:h.db,LISTING_IMAGES:bucket}});
 return {...h,objects,deleted,bucket,upload,cookie};
}
test('servidor rejeita assinatura PNG sem imagem, CRC inválido e dimensões excessivas',()=>{
 assert.throws(()=>cleanPhoto(new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0])));
 const corrupted=valid();corrupted[29]^=1;assert.throws(()=>cleanPhoto(corrupted));
 const huge=valid();huge.writeUInt32BE(9000,16);assert.throws(()=>cleanPhoto(huge));
 const result=cleanPhoto(valid());assert.equal(PNG.sync.read(Buffer.from(result)).width,8);
});
test('foto exige origem, sessão e propriedade e respeita o tamanho',async()=>{
 const h=await setup();assert.equal((await h.upload(valid(),{Origin:'https://other.invalid'})).status,403);
 assert.equal((await h.upload(valid(),{Cookie:''})).status,401);
 assert.equal((await h.upload(valid(),{'Content-Length':'4000000'})).status,413);
 assert.equal((await h.upload(Buffer.from('invalid'))).status,415);
 h.sqlite.exec("INSERT INTO marketplace_sellers(id,display_name,whatsapp) VALUES ('other','Outra conta','5592999999999'); UPDATE marketplace_listings SET seller_id='other' WHERE id=1");
 assert.equal((await h.upload()).status,404);assert.equal(h.objects.size,0);
});
test('substituição remove a foto anterior e a conta tem limite de 10 envios',async()=>{
 const h=await setup();
 for(let i=0;i<10;i++)assert.equal((await h.upload()).status,200);
 assert.equal(h.objects.size,1);assert.equal(h.deleted.length,9);
 assert.equal((await h.upload()).status,429);assert.equal(h.objects.size,1);
 h.sqlite.exec('UPDATE marketplace_rate_limits SET expires_at=0');
 assert.equal((await h.upload()).status,200);assert.equal(h.objects.size,1);
});
test('mudança concorrente impede sobrescrita e remove o objeto novo',async()=>{
 const h=await setup();const original=h.bucket.put;
 h.bucket.put=async(key,bytes)=>{await original(key,bytes);h.sqlite.exec("UPDATE marketplace_listings SET status='removed' WHERE id=1")};
 assert.equal((await h.upload()).status,409);assert.equal(h.objects.size,0);
});
test('falha na limpeza é informada sem fingir que a foto nova não foi salva',async()=>{
 const h=await setup();assert.equal((await h.upload()).status,200);
 h.bucket.delete=async()=>{throw Error('storage error')};
 const response=await h.upload();assert.equal(response.status,200);assert.match((await response.json()).warning,/pendente/);
});

test('disponibilidade de fotos informa ausência de armazenamento sem expor configurações',async()=>{
 const request=new Request(origin+'/api/media-upload');
 const missing=await onRequest({request,env:{}});assert.deepEqual(await missing.json(),{available:false});
 const ready=await onRequest({request,env:{MARKETPLACE_DB:{},LISTING_IMAGES:{}}});assert.deepEqual(await ready.json(),{available:true});
});

test('falha na limpeza após alteração concorrente mantém resposta 409',async()=>{
 const h=await setup();
 h.bucket.put=async(key,bytes)=>{
  h.objects.set(key,bytes);
  h.sqlite.exec("UPDATE marketplace_listings SET status='removed' WHERE id=1");
 };
 h.bucket.delete=async()=>{throw new Error('R2 indisponível')};
 const response=await h.upload();
 assert.equal(response.status,409);
 assert.equal((await response.json()).code,'LISTING_CHANGED');
});

test('falha na confirmação do banco não mascara a resposta se a limpeza falhar',async()=>{
 const h=await setup();
 const originalPut=h.bucket.put;
 h.bucket.put=async(key,bytes)=>{
  await originalPut(key,bytes);
  // Simulate DB update failure after the provider successfully stores the PNG.
  h.sqlite.exec('DROP TABLE marketplace_listings');
 };
 h.bucket.delete=async()=>{throw new Error('Falha ao remover órfão')};
 const response=await h.upload();
 assert.equal(response.status,503);
 assert.match((await response.json()).error,/confirmar a foto/);
});

test('resposta de upload perdida pode ser consultada e repetida sem novo objeto ou gasto de cota',async t=>{
 const h=await setup();t.after(()=>h.sqlite.close());
 const op=crypto.randomUUID(),headers={'X-Photo-Request':op,'X-Previous-Photo':'original'};
 const accepted=await h.upload(valid(),headers);assert.equal(accepted.status,200);
 const {image}=await accepted.json();
 const request=path=>handleAccount({env:{MARKETPLACE_DB:h.db},request:new Request(origin+'/api/account/'+path,{headers:{Cookie:h.cookie}})});
 assert.equal((await (await request('listings/1/photo')).json()).photoVersion,op);
 assert.equal((await (await h.upload(valid(),headers)).json()).image,image);
 assert.equal(h.objects.size,1);assert.equal(h.deleted.length,0);
 const next=crypto.randomUUID();
 assert.equal((await h.upload(valid(),{'X-Photo-Request':next,'X-Previous-Photo':op})).status,200);
 assert.equal((await h.upload(valid(),headers)).status,409);
 assert.equal(h.sqlite.prepare('SELECT photo_request_id FROM marketplace_listings').get().photo_request_id,next);
 assert.equal(h.deleted.length,1);
});
test('foto de anúncio pausado aparece na área do dono, inclusive na edição, e fica privada para visitantes',async t=>{
 const h=await setup();t.after(()=>h.sqlite.close());const {image}=await (await h.upload()).json();
 h.sqlite.exec("UPDATE marketplace_listings SET status='paused'");
 const list=await handleAccount({env:{MARKETPLACE_DB:h.db},request:new Request(origin+'/api/account/listings',{headers:{Cookie:h.cookie}})});
 const saved=(await list.json()).listings[0];
 assert.match(saved.image,/^\/api\/media\/owner-1/);
 const env={MARKETPLACE_DB:h.db,LISTING_IMAGES:{async get(key){return h.objects.has(key)?{body:h.objects.get(key)}:null}}};
 const get=(url,cookie='')=>readMedia({env,request:new Request(new URL(url,origin),{headers:{Cookie:cookie}})});
 assert.equal((await get(image)).status,404);
 assert.equal((await get(saved.image)).status,401);
 const own=await get(saved.image,h.cookie);assert.equal(own.status,200);assert.match(own.headers.get('cache-control'),/no-store/);
 h.sqlite.exec("INSERT INTO marketplace_sellers(id,display_name) VALUES ('outro','Outro vendedor'); UPDATE marketplace_listings SET seller_id='outro' WHERE id=1");
 assert.equal((await get(saved.image,h.cookie)).status,404);
});
