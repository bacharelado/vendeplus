import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareProduction} from '../scripts/prepare-production.mjs';
const migration=['0001_marketplace','0002_accounts','0003_vendeplus_2'].map(n=>readFileSync(new URL('../migrations/'+n+'.sql',import.meta.url),'utf8')).join('\n');
const productionId='11111111-1111-4111-8111-111111111111',previewId='22222222-2222-4222-8222-222222222222';
function harness(){
 const project={name:'vendeplus',production_branch:'main',canonical_deployment:{id:'original'},deployment_configs:{production:{d1_databases:{},r2_buckets:{},env_vars:{existing:{value:'keep'}}},preview:{d1_databases:{MARKETPLACE_DB:{id:previewId}}}}};
 const calls=[];let created=false;
 const fetchImpl=async(url,init)=>{
  const method=init.method,body=init.body?JSON.parse(init.body):undefined;calls.push({url,method,body});let result;
  if(url.includes('/pages/projects/')){if(method==='PATCH')Object.assign(project.deployment_configs.production,body.deployment_configs.production);result=structuredClone(project)}
  else if(url.includes('/query'))result=body.sql.startsWith('SELECT')?[{success:true,results:['marketplace_accounts','marketplace_sessions','marketplace_listings','marketplace_sellers','marketplace_reports'].map(name=>({name}))}]:[{success:true}];
  else if(method==='POST'){created=true;result={name:'vendeplus-production',uuid:productionId}}
  else if(url.endsWith('/'+productionId))result={name:'vendeplus-production',uuid:productionId};
  else result=created?[{name:'vendeplus-production',uuid:productionId}]:[];
  return Response.json({success:true,result});
 };
 return {project,calls,fetchImpl,run:extra=>prepareProduction({token:'secret-test-value',ref:'refs/heads/feat/vendeplus-2.0',migration,fetchImpl,...extra})};
}
test('prepara produção sem substituir prévia ou publicar conteúdo',async()=>{
 const h=harness(),preview=structuredClone(h.project.deployment_configs.preview);assert.equal((await h.run()).ready,true);
 assert.deepEqual(h.project.deployment_configs.preview,preview);assert.equal(h.project.canonical_deployment.id,'original');assert.equal(h.project.deployment_configs.production.env_vars.existing.value,'keep');
 assert(h.calls.every(c=>c.url.startsWith('https://api.cloudflare.com/')));assert(!h.calls.some(c=>c.url.includes('/deployments')));
});
test('reexecução reutiliza banco e preserva outros bindings',async()=>{const h=harness();await h.run();h.project.deployment_configs.production.d1_databases.OTHER={id:'other'};await h.run();assert.equal(h.calls.filter(c=>c.method==='POST'&&c.url.endsWith('/d1/database')).length,1);assert.equal(h.project.deployment_configs.production.d1_databases.OTHER.id,'other')});
test('sem token, branch autorizada ou SQL incremental nenhuma chamada é feita',async()=>{for(const extra of [{token:''},{ref:'refs/heads/main'},{migration:'DROP TABLE marketplace_accounts;'}]){const h=harness();await assert.rejects(h.run(extra));assert.equal(h.calls.length,0)}});
test('não toca em banco compartilhado com a prévia',async()=>{const h=harness();h.project.deployment_configs.production.d1_databases.MARKETPLACE_DB={id:previewId};await assert.rejects(h.run(),/compartilham/);assert(!h.calls.some(c=>c.method!=='GET'))});
test('falha de migração impede alteração de binding e não expõe segredo',async()=>{const h=harness();const fetchImpl=async(url,init)=>url.includes('/query')?Response.json({success:false,errors:[{code:1,message:'secret-test-value'}]},{status:500}):h.fetchImpl(url,init);await assert.rejects(h.run({fetchImpl}),e=>!e.message.includes('secret-test-value'));assert(!h.calls.some(c=>c.method==='PATCH'))});
