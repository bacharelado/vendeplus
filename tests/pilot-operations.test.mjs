import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {d1Query} from './helpers/d1-rest.mjs';
import {readMigrations,applyMigrations} from '../scripts/d1-migrations.mjs';
import {verifyProductionBuild} from '../scripts/production-build-gate.mjs';
const files=await readMigrations();

for(const level of [0,3,4,5,6]){
 test('migração da versão '+level+' mantém linhas e segunda passagem não executa DDL de negócio',async t=>{
  const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
  for(const f of files.slice(0,level))sqlite.exec(f.sql);
  if(level){
   sqlite.exec("INSERT INTO marketplace_sellers(id,display_name,whatsapp,status) VALUES ('test','Loja existente','5592999991234','approved')");
   if(level>=5)sqlite.exec("INSERT INTO marketplace_seller_profiles(seller_id,bio,slug) VALUES ('test','Bio existente','loja-local')");
  }
  const query=d1Query(sqlite);
  await applyMigrations(query,files);
  if(level){
   const row=sqlite.prepare("SELECT * FROM marketplace_sellers WHERE id='test'").get();
   assert.equal(row.display_name,'Loja existente');assert.equal(row.whatsapp,'5592999991234');assert.equal(row.status,'approved');assert.equal(row.verified_whatsapp,null);assert.equal(row.profile_contact,0);
   if(level>=5)assert.equal(sqlite.prepare("SELECT slug FROM marketplace_seller_profiles WHERE seller_id='test'").get().slug,'loja-local');
  }
  const log=[];
  assert.deepEqual(await applyMigrations((sql,params)=>{log.push(sql);return query(sql,params)},files),[]);
  assert.ok(!log.some(s=>/^(?:ALTER|INSERT|DROP|DELETE)/i.test(s)));assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM marketplace_schema_migrations').get().n,6);
 });
}
test('0005 parcialmente aplicada é retomada, divergência e versões desconhecidas param sem substituir dados',async t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());const q=d1Query(db);
 files.slice(0,4).forEach(f=>db.exec(f.sql));
 db.exec(files[4].sql.split(';')[0]);await applyMigrations(q,files);
 db.exec("UPDATE marketplace_schema_migrations SET checksum='different' WHERE name LIKE '0005%'");
 await assert.rejects(applyMigrations(q,files),/checksum/);
 db.exec("UPDATE marketplace_schema_migrations SET name='0007_future.sql' WHERE name LIKE '0005%'");
 await assert.rejects(applyMigrations(q,files),/desconhecida/);
});
test('uma coluna legada incompatível ou uma interrupção nunca recebe recibo falso',async t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());const q=d1Query(db);
 files.slice(0,4).forEach(f=>db.exec(f.sql));
 db.exec('ALTER TABLE marketplace_seller_profiles ADD COLUMN slug INTEGER');
 await assert.rejects(applyMigrations(q,files),/incompatível/);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM marketplace_schema_migrations WHERE name LIKE '0005%'").get().n,0);
});
const sha='a'.repeat(40),env={CF_PAGES:'1',CF_PAGES_BRANCH:'main',CF_PAGES_COMMIT_SHA:sha,VENDEPLUS_APPROVED_PRODUCTION_SHA:sha};
function github(change=()=>{}){
 const calls=[];
 const fetch=async url=>{
  calls.push(url);
  const quality=url.includes('quality.yml')||url.includes('/runs/1/');
  const workflow=quality?'quality.yml':'playwright.yml';
  const run={id:quality?1:2,run_attempt:1,head_sha:sha,head_branch:'main',event:'push',path:'.github/workflows/'+workflow,
   head_repository:{full_name:'bacharelado/vendeplus'},status:'completed',conclusion:'success'};
  const job={head_sha:sha,name:quality?'verificar':'Playwright — computador e celular',status:'completed',conclusion:'success'};
  change(run,job,workflow);
  return Response.json(url.includes('/attempts/')?{jobs:[job]}:{workflow_runs:[run]});
 };return {calls,fetch};
}
test('build local e prévia independem de produção e o SHA autorizado precisa dos dois jobs',async()=>{
 const g=github();await verifyProductionBuild({},g.fetch);await verifyProductionBuild({...env,CF_PAGES_BRANCH:'fix/piloto'},g.fetch);
 assert.equal(g.calls.length,0);assert.equal(await verifyProductionBuild(env,g.fetch),sha);assert.equal(g.calls.length,4);
});
test('produção bloqueia ausência de autorização, outro SHA, tentativa incompleta, job pulado e API fora do ar',async()=>{
 for(const overwrite of [{CF_PAGES_BRANCH:''},{CF_PAGES_COMMIT_SHA:'x'},{VENDEPLUS_APPROVED_PRODUCTION_SHA:'b'.repeat(40)}]){
  const g=github();await assert.rejects(verifyProductionBuild({...env,...overwrite},g.fetch));assert.equal(g.calls.length,0);
 }
 for(const change of [r=>r.head_sha='b'.repeat(40),r=>r.conclusion='failure',r=>r.status='in_progress',r=>r.event='pull_request',r=>r.head_repository.full_name='outro/projeto',(_r,j)=>j.conclusion='skipped']){
  const g=github((r,j,w)=>{if(w==='playwright.yml')change(r,j)});await assert.rejects(verifyProductionBuild(env,g.fetch));
 }
 await assert.rejects(verifyProductionBuild(env,async()=>new Response('',{status:503})));
});
