import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {onRequest} from '../functions/api/reports.ts';
const files=['0001_marketplace','0002_accounts','0003_vendeplus_2'];
const migration=(await Promise.all(files.map(name=>readFile(new URL('../migrations/'+name+'.sql',import.meta.url),'utf8')))).join('\n');
function setup(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(migration);
 sqlite.prepare("INSERT INTO marketplace_sellers(id,display_name,status) VALUES (?,?,?)").run('seller','Loja do bairro','pending');
 const query="INSERT INTO marketplace_listings(seller_id,title,description,price_cents,category,condition,fulfillment,status) VALUES (?,?,?,?,?,?,?,?)";
 const id=Number(sqlite.prepare(query).run('seller','Produto para denúncia','Oferta de teste sem compradores.',1000,'Casa','Novo','A combinar','published').lastInsertRowid);
 const db={prepare(sql){let values=[];const statement={bind(...args){values=args;return statement},async first(){return sqlite.prepare(sql).get(...values)||null},async run(){return {meta:sqlite.prepare(sql).run(...values)}}};return statement}};
 const send=(reason='spam',details='Oferta repetida no catálogo.',ip='192.0.2.1')=>onRequest({request:new Request('https://preview.vendeplus.pages.dev/api/reports',{method:'POST',headers:{Origin:'https://preview.vendeplus.pages.dev','Content-Type':'application/json','CF-Connecting-IP':ip},body:JSON.stringify({listingId:id,reason,details})}),env:{MARKETPLACE_DB:db}});
 return {sqlite,send,id,db};
}
test('denúncia entra na fila sem expor detalhes privados',async()=>{
 const {sqlite,send}=setup();
 const response=await send();assert.equal(response.status,201);assert.deepEqual(await response.json(),{ok:true});
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS total FROM marketplace_reports').get().total,1);
 assert.match(sqlite.prepare('SELECT reporter_hash FROM marketplace_reports').get().reporter_hash,/^[a-f0-9]{64}$/);
});
test('denúncias repetidas do mesmo endereço não duplicam entradas',async()=>{
 const {sqlite,send}=setup();assert.equal((await send()).status,201);assert.equal((await send()).status,201);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS total FROM marketplace_reports').get().total,1);
});
test('bloqueia métodos de escrita inválidos e razões desconhecidas',async()=>{
 const {send,db}=setup();assert.equal((await send('desconhecido')).status,400);
 const response=await onRequest({request:new Request('https://preview.vendeplus.pages.dev/api/reports'),env:{MARKETPLACE_DB:db}});
 assert.equal(response.status,405);
});
test('limita tentativas de denúncia para impedir abuso automático',async()=>{
 const {send}=setup();for(let i=0;i<10;i++)assert.equal((await send()).status,201);
 assert.equal((await send()).status,429);
});
