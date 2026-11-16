import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {videoIdFromUrl,videoWatchUrl} from '../src/lib/video.mjs';
import {handleAccount} from '../functions/_shared/account.ts';
import {onRequest as publicListings} from '../functions/api/listings.ts';
import {database} from './helpers/database.mjs';

const id='dQw4w9WgXcQ';
const valid=['https://www.youtube.com/watch?v='+id,'https://youtu.be/'+id,'https://youtube.com/shorts/'+id,'https://m.youtube.com/embed/'+id,'https://youtu.be/'+id+'?si=test'];

test('link HTTPS do YouTube é convertido em ID seguro',()=>{
 for(const value of valid)assert.equal(videoIdFromUrl(value),id);
 assert.equal(videoWatchUrl(id),'https://www.youtube.com/watch?v='+id);
});
test('URL maliciosa não vira player embutido',()=>{
 for(const value of ['javascript:alert(1)','http://youtu.be/'+id,'https://youtu.be.evil.test/'+id,'https://youtube.com.evil.test/watch?v='+id,'https://evil.test/video','https://evil.test@youtube.com/watch?v='+id,'https://www.youtube.com/watch?v=<script>','https://youtu.be/invalid','https://www.youtube.com/playlist?list='+id])assert.equal(videoIdFromUrl(value),null,value);
});
test('link com vídeo exige moderação e é listado com ID ao dono e ao público aprovado',async()=>{
 const {sqlite,db}=database();
 const seller='11111111-1111-4111-8111-111111111111';
 const token='a'.repeat(64),tokenHash=createHash('sha256').update(token).digest('hex');
 sqlite.prepare('INSERT INTO marketplace_sellers(id,display_name,whatsapp,status) VALUES (?,?,?,?)').run(seller,'Loja de teste','5592999999999','approved');
 sqlite.prepare('INSERT INTO marketplace_accounts(id,email,password_hash,neighborhood) VALUES (?,?,?,?)').run(seller,'loja@example.invalid','hash','Poranga II');
 sqlite.prepare('INSERT INTO marketplace_sessions(token_hash,account_id,expires_at) VALUES (?,?,?)').run(tokenHash,seller,Math.floor(Date.now()/1000)+3600);
 const url='https://vendeplus.test/api/account/listings';
 const payload={requestId:crypto.randomUUID(),title:'Mesa de teste com vídeo',description:'Mesa de madeira em bom estado de uso.',priceCents:5000,category:'Casa',condition:'Usado',fulfillment:'Retirada no bairro',neighborhood:'Poranga II',videoUrl:valid[0]};
 const request=(body,method='POST',suffix='')=>handleAccount({request:new Request(url+suffix,{method,headers:{Origin:'https://vendeplus.test',Cookie:'__Host-vendeplus='+token,'Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(body)}),env:{MARKETPLACE_DB:db}});
 const invalid=await request({...payload,videoUrl:'https://youtube.com.evil.test/watch?v='+id});
 assert.equal(invalid.status,400);
 const created=await request(payload);assert.equal(created.status,201);
 const result=await created.json();assert.equal(result.status,'pending');
 assert.equal(sqlite.prepare('SELECT video_id FROM marketplace_listings WHERE id=?').get(result.id).video_id,id);
 const own=await request(undefined,'GET');assert.equal((await own.json()).listings[0].videoId,id);
 const catalogReq=new Request('https://vendeplus.test/api/listings');
 assert.equal((await (await publicListings({request:catalogReq,env:{MARKETPLACE_DB:db}})).json()).listings.length,0);
 sqlite.prepare("UPDATE marketplace_listings SET status='published' WHERE id=?").run(result.id);
 const pub=await (await publicListings({request:catalogReq,env:{MARKETPLACE_DB:db}})).json();
 assert.equal(pub.listings[0].videoId,id);
 const legacy=await request({...payload,action:'edit',videoUrl:undefined},'PATCH','/'+result.id);
 assert.equal(legacy.status,200);
 assert.equal(sqlite.prepare('SELECT video_id FROM marketplace_listings WHERE id=?').get(result.id).video_id,id);
 const edited=await request({...payload,action:'edit',videoUrl:''},'PATCH','/'+result.id);assert.equal(edited.status,200);
 assert.equal(sqlite.prepare('SELECT video_id FROM marketplace_listings WHERE id=?').get(result.id).video_id,null);
});
