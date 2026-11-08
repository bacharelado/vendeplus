import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {connectPreviewDatabase,branchName,databaseName,publicPreviewUrl} from '../scripts/connect-preview-database.mjs';
const db='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const deploymentId='33333333-3333-4333-8333-333333333333';
const retriedId='44444444-4444-4444-8444-444444444444';
const sha='a'.repeat(40);
const migration=await readFile(new URL('../migrations/0001_marketplace.sql',import.meta.url),'utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
function harness(options={}){
  const requests=[],logs=[];
  const project={
    name:'vendeplus',
    production_branch:'main',
    canonical_deployment:{id:other},
    deployment_configs:{
      production:{d1_databases:{REAL_DATABASE:{id:other}},env_vars:{KEEP:{type:'plain_text',value:'preserve'}}},
      preview:{d1_databases:{OTHER_BINDING:{id:other}},env_vars:{KEEP:{type:'plain_text',value:'preview'}}}
    }
  };
  if(options.productionDatabase)project.deployment_configs.production.d1_databases.MARKETPLACE_DB={id:db};
  if(options.bound)project.deployment_configs.preview.d1_databases.MARKETPLACE_DB={id:db};
  if(options.conflict)project.deployment_configs.preview.d1_databases.MARKETPLACE_DB={id:other};
  if(options.productionBranch)project.production_branch=branchName;
  const deploy={id:deploymentId,environment:options.productionDeployment?'production':'preview',deployment_trigger:{metadata:{branch:branchName,commit_hash:sha}},latest_stage:{name:'deploy',status:'success'},url:'https://verified.vendeplus.pages.dev'};
  const initial=clone(project);
  const response=(result,status=200)=>new Response(JSON.stringify({success:status===200,result,...(status===200?{}:{errors:[{code:10000,message:'unit-test-secret'}]})}),{status,headers:{'Content-Type':'application/json'}});
  const fetchImpl=async(url,init={})=>{
    requests.push({url,method:init.method||'GET',body:init.body?JSON.parse(init.body):undefined,headers:init.headers});
    if(options.rejectApi)return response(null,403);
    if(url.includes('verified.vendeplus.pages.dev'))return new Response(JSON.stringify(options.badCatalog?{error:'unavailable'}:{listings:[]}),{status:options.badCatalog?503:200});
    if(url.includes('/d1/database?'))return response(options.existing===false?[]:[{uuid:db,name:databaseName}]);
    if(url.endsWith('/d1/database')&&init.method==='POST')return response({uuid:db,name:databaseName});
    if(url.endsWith('/query')){
      if(init.body.includes('sqlite_master'))return response([{success:true,results:[{name:'marketplace_listings'},{name:'marketplace_sellers'}]}]);
      return response([{success:!options.failedMigration}]);
    }
    if(url.includes('/deployments?')){
      if(Number(new URL(url).searchParams.get('per_page'))>25)return response(null,400);
      return response(options.missingDeployment?[]:[deploy]);
    }
    if(url.endsWith('/retry'))return response({...deploy,id:retriedId,latest_stage:{name:options.failedBuild?'build':'deploy',status:options.failedBuild?'failure':'success'}});
    if(url.endsWith('/pages/projects/vendeplus')){
      if(init.method==='PATCH')Object.assign(project.deployment_configs.preview,JSON.parse(init.body).deployment_configs.preview);
      return response(clone(project));
    }
    throw Error('Unexpected request');
  };
  const run=(extra={})=>connectPreviewDatabase({token:'unit-test-secret',ref:`refs/heads/${branchName}`,commit:sha,migration,fetchImpl,sleep:async()=>{},log:text=>logs.push(text),maxPolls:2,...extra});
  return {run,requests,logs,project,initial};
}

test('configura apenas preview, preserva outros bindings e nunca envia token à prévia pública',async()=>{
  const h=harness({existing:false});const result=await h.run();
  assert.deepEqual(h.project.deployment_configs.production,h.initial.deployment_configs.production);
  const patches=h.requests.filter(r=>r.method==='PATCH');assert.equal(patches.length,1);
  assert.deepEqual(Object.keys(patches[0].body.deployment_configs),['preview']);
  assert.deepEqual(patches[0].body.deployment_configs.preview.d1_databases,{OTHER_BINDING:{id:other},MARKETPLACE_DB:{id:db}});
  assert.equal(h.project.canonical_deployment.id,h.initial.canonical_deployment.id);
  assert.equal(result.previewUrl,'https://verified.vendeplus.pages.dev');assert.equal(result.listingCount,0);
  assert.equal(h.requests.find(r=>r.url.includes('verified.vendeplus')).headers.Authorization,undefined);
  assert(!h.logs.join(' ').includes('unit-test-secret'));
});

test('reexecução reutiliza banco e binding sem recriar ou substituir',async()=>{
  const h=harness({bound:true});await h.run();
  assert.equal(h.requests.filter(r=>r.url.endsWith('/d1/database')&&r.method==='POST').length,0);
  assert.equal(h.requests.filter(r=>r.method==='PATCH').length,0);
});

test('segredo ausente impede qualquer acesso de rede',async()=>{
  const h=harness();await assert.rejects(h.run({token:''}),/CLOUDFLARE_API_TOKEN/);assert.equal(h.requests.length,0);
});

test('branch main é recusada antes de qualquer acesso',async()=>{
  const h=harness();await assert.rejects(h.run({ref:'refs/heads/main'}),/somente na branch/);assert.equal(h.requests.length,0);
});

test('projeto cuja branch de produção coincide com desenvolvimento é recusado',async()=>{
  const h=harness({productionBranch:true});await assert.rejects(h.run(),/branch selecionada é de produção/);
  assert.equal(h.requests.filter(r=>r.method!=='GET').length,0);
});

test('banco compartilhado com produção não recebe migração nem alterações',async()=>{
  const h=harness({productionDatabase:true});await assert.rejects(h.run(),/vinculado à produção/);
  assert.equal(h.requests.filter(r=>r.method!=='GET').length,0);
});

test('binding de prévia que aponta para outro banco não é substituído',async()=>{
  const h=harness({conflict:true});await assert.rejects(h.run(),/já aponta para outro banco/);
  assert.equal(h.requests.filter(r=>r.method!=='GET').length,0);
});

test('falha de migração impede vinculação e deployment',async()=>{
  const h=harness({failedMigration:true});await assert.rejects(h.run(),/migração não foi confirmada/);
  assert.equal(h.requests.filter(r=>r.method==='PATCH'||r.url.endsWith('/retry')).length,0);
});

test('deployment de produção nunca é repetido',async()=>{
  const h=harness({productionDeployment:true});await assert.rejects(h.run(),/deployment não corresponde/);
  assert.equal(h.requests.filter(r=>r.url.endsWith('/retry')).length,0);
});

test('build com erro não gera confirmação de conexão',async()=>{
  const h=harness({failedBuild:true});await assert.rejects(h.run(),/A implantação da prévia falhou/);
  assert(!h.logs.some(log=>log.includes('API validada')));
});

test('API pública com erro não gera confirmação de conexão',async()=>{
  const h=harness({badCatalog:true});await assert.rejects(h.run(),/API da prévia ainda não respondeu/);
  assert(!h.logs.some(log=>log.includes('API validada')));
});

test('mensagem de erro do provedor não vaza token nem corpo da resposta',async()=>{
  const h=harness({rejectApi:true});await assert.rejects(h.run(),error=>error.message.includes('403')&&!error.message.includes('unit-test-secret'));
});

test('aceita somente subdomínio HTTPS de prévia, nunca produção ou outro host',()=>{
  assert.equal(publicPreviewUrl('https://hash.vendeplus.pages.dev/'),'https://hash.vendeplus.pages.dev');
  for(const url of ['https://vendeplus.pages.dev','http://hash.vendeplus.pages.dev','https://hash.vendeplus.pages.dev.evil.test','https://user:password@hash.vendeplus.pages.dev','https://hash.vendeplus.pages.dev:8443'])assert.throws(()=>publicPreviewUrl(url));
});

test('listagem de deployments usa a paginação padrão aceita pelo provedor',async()=>{const h=harness();await h.run();const request=h.requests.find(r=>r.url.includes('/deployments?'));assert.equal(new URL(request.url).searchParams.get('per_page'),null);assert.equal(new URL(request.url).searchParams.get('env'),'preview')});

test('migração de contas habilita crypto apenas na prévia e mantém a configuração de produção',async()=>{
 const h=harness({bound:true});await h.run({migration:migration+'\nCREATE TABLE IF NOT EXISTS marketplace_accounts (id TEXT);'});const patch=h.requests.find(r=>r.method==='PATCH');assert.deepEqual(patch.body.deployment_configs.preview.compatibility_flags,['nodejs_compat']);assert.equal(patch.body.deployment_configs.preview.compatibility_date,'2025-04-08');assert.deepEqual(h.project.deployment_configs.production,h.initial.deployment_configs.production);
});
