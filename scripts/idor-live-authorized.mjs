import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {appendFile} from 'node:fs/promises';
import {accountId,projectName} from './connect-preview-database.mjs';
if(process.env.GITHUB_REF!=='refs/heads/ops/idor-duas-contas-20261112'||process.env.GITHUB_RUN_ATTEMPT!=='1')throw Error('Execução limitada à rodada autorizada.');
const origin='https://feat-ux-compra-venda-v2.vendeplus.pages.dev';
const token=process.env.CLOUDFLARE_API_TOKEN;if(!token)throw Error('Acesso Cloudflare ausente.');
async function cf(path,body){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+accountId+path,{method:body?'POST':'GET',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
 const data=await r.json();
 if(!r.ok||!data.success||Array.isArray(data.result)&&data.result.some(x=>x.success===false))throw Error('Operação Cloudflare não confirmada: HTTP '+r.status);
 return data.result;
}
const project=await cf('/pages/projects/'+projectName);
const preview=project.deployment_configs?.preview?.d1_databases?.MARKETPLACE_DB?.id;
const production=project.deployment_configs?.production?.d1_databases?.MARKETPLACE_DB?.id;
if(project.name!==projectName||!preview||!production||preview===production)throw Error('Isolamento dos bancos não confirmado.');
const info=await cf('/d1/database/'+preview);if(info.name!=='vendeplus-preview')throw Error('Banco de teste inesperado.');
const deployments=await cf('/pages/projects/'+projectName+'/deployments?per_page=25');
const deployed=deployments.find(d=>d.environment==='preview'&&d.deployment_trigger?.metadata?.branch==='feat/ux-compra-venda-v2'&&d.latest_stage?.status==='success'&&d.aliases?.includes(origin));
if(!deployed||deployed.deployment_trigger?.metadata?.commit_hash!==project.canonical_deployment?.deployment_trigger?.metadata?.commit_hash)throw Error('Prévia não corresponde ao código oficial. Teste interrompido antes de criar dados.');
const query=async(id,sql,params=[])=>{const data=await cf('/d1/database/'+id+'/query',{sql,params});return data[0].results};
const counts=id=>query(id,'SELECT (SELECT COUNT(*) FROM marketplace_accounts) AS accounts,(SELECT COUNT(*) FROM marketplace_listings) AS listings');
const productionBefore=await counts(production),previewBefore=await counts(preview);
const marker='idor-'+randomBytes(12).toString('hex');
const emails=[marker+'-a@example.invalid',marker+'-b@example.invalid'];
const passwords=[randomBytes(24).toString('base64url'),randomBytes(24).toString('base64url')];
const accountIds=[];
let listingId=null,requestId=randomUUID();
const report={targetEnvironment:'preview',testedCommit:deployed.deployment_trigger.metadata.commit_hash,checks:[],cleanup:null,productionPreserved:null};
async function api(path,method='GET',data,cookie=''){
 const r=await fetch(origin+'/api/account/'+path,{method,redirect:'error',headers:{Origin:origin,Accept:'application/json','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(25000)});
 let body;try{body=await r.json()}catch{throw Error('Resposta não JSON no endpoint '+path)}
 return {status:r.status,body,cookie:r.headers.get('Set-Cookie')?.split(';')[0]||''};
}
const record=(test,status,extra={})=>report.checks.push({test,http:status,...extra});
async function listing(){return (await query(preview,'SELECT l.id,l.seller_id,l.title,l.description,l.price_cents,l.category,l.condition,l.fulfillment,l.status,l.image_url,d.neighborhood FROM marketplace_listings l LEFT JOIN marketplace_listing_details d ON d.listing_id=l.id WHERE l.id=?',[listingId]))[0]}
let problem;
try{
 const sessions=[];
 for(let i=0;i<2;i++){
  const r=await api('register','POST',{name:'Teste temporário '+(i===0?'A':'B'),email:emails[i],password:passwords[i],neighborhood:'Poranga II',whatsapp:'5592000000000',acceptContact:true});
  assert.equal(r.status,201,'Cadastro temporário não concluído.');
  accountIds.push(r.body.account.id);
  assert.equal(r.body.account.role,'seller');assert(r.cookie);
  sessions.push(r.cookie);record('cadastro_'+(i===0?'A':'B'),r.status);
 }
 const offer={requestId,title:'TESTE TEMPORÁRIO — mesa de demonstração',description:'Registro temporário de avaliação autorizada. Sem venda real ou negociação.',priceCents:100,category:'Casa',condition:'Usado',fulfillment:'Demonstração técnica, sem entrega.',neighborhood:'Poranga II'};
 const created=await api('listings','POST',offer,sessions[0]);
 assert.equal(created.status,201,'Publicação temporária não concluída.');listingId=Number(created.body.id);assert(Number.isSafeInteger(listingId));assert.equal(created.body.status,'published');
 record('publicar_com_A',created.status,{published:true});
 const validEdit={...offer,action:'edit',title:'TESTE TEMPORÁRIO — edição pelo proprietário',priceCents:200};
 const ownerEdit=await api('listings/'+listingId,'PATCH',validEdit,sessions[0]);assert.equal(ownerEdit.status,200,'Controle positivo: proprietário não conseguiu editar.');
 const baseline=await listing();assert.equal(baseline.title,validEdit.title);assert.equal(baseline.price_cents,200);assert.equal(baseline.seller_id,accountIds[0]);
 record('A_edita_seu_anuncio',ownerEdit.status,{changedAsExpected:true});
 const ownList=await api('listings','GET',undefined,sessions[0]);assert(ownList.body.listings.some(x=>x.id===listingId));record('A_lista_seu_anuncio',ownList.status);
 const otherList=await api('listings','GET',undefined,sessions[1]);assert.equal(otherList.status,200);assert.equal(otherList.body.listings.length,0);record('B_nao_lista_anuncio_privado_de_A',otherList.status,{isolated:true});
 const attempts=[
  ['B_tenta_editar_anuncio_de_A',{...validEdit,title:'ALTERAÇÃO NÃO AUTORIZADA',priceCents:999}],
  ['B_tenta_pausar_anuncio_de_A',{status:'paused'}],
  ['B_tenta_marcar_vendido_anuncio_de_A',{status:'sold'}],
  ['B_tenta_remover_anuncio_de_A',{status:'removed'}]
 ];
 for(const [name,payload] of attempts){
  const response=await api('listings/'+listingId,'PATCH',payload,sessions[1]);
  const after=await listing();const unchanged=JSON.stringify(after)===JSON.stringify(baseline);
  record(name,response.status,{unchanged});
  assert([403,404].includes(response.status),'Tentativa de outra conta não foi bloqueada.');
  assert(unchanged,'O anúncio mudou após uma tentativa da conta B.');
 }
 const admin=await api('admin/stats','GET',undefined,sessions[1]);assert.equal(admin.status,403);record('B_nao_acessa_administracao',admin.status);
 const ownerAfter=await api('listings','GET',undefined,sessions[0]);
 assert.equal(ownerAfter.body.listings.find(x=>x.id===listingId)?.title,validEdit.title);record('A_confirma_anuncio_intacto',ownerAfter.status,{unchanged:true});
}catch(error){problem=error instanceof Error?error.message:'Falha desconhecida.'}
finally{
 try{
  const targets=await query(preview,'SELECT id FROM marketplace_accounts WHERE email IN (?,?)',emails);
  for(const row of targets)if(!accountIds.includes(row.id))accountIds.push(row.id);
  if(accountIds.length){
   const placeholders=accountIds.map(()=>'?').join(',');
   const owned='IN (SELECT id FROM marketplace_listings WHERE seller_id IN ('+placeholders+'))';
   const steps=[
    ['DELETE FROM marketplace_reports WHERE listing_id '+owned+' OR resolved_by IN ('+placeholders+')',[...accountIds,...accountIds]],
    ['DELETE FROM marketplace_moderation_log WHERE listing_id '+owned+' OR admin_id IN ('+placeholders+')',[...accountIds,...accountIds]],
    ['DELETE FROM marketplace_seller_reviews WHERE seller_id IN ('+placeholders+') OR admin_id IN ('+placeholders+')',[...accountIds,...accountIds]],
    ['DELETE FROM marketplace_listing_events WHERE seller_id IN ('+placeholders+') OR listing_id '+owned,[...accountIds,...accountIds]],
    ['DELETE FROM marketplace_listing_details WHERE seller_id IN ('+placeholders+')',accountIds],
    ['DELETE FROM marketplace_listings WHERE seller_id IN ('+placeholders+')',accountIds],
    ['DELETE FROM marketplace_sessions WHERE account_id IN ('+placeholders+')',accountIds],
    ['DELETE FROM marketplace_password_resets WHERE account_id IN ('+placeholders+')',accountIds],
    ['DELETE FROM marketplace_seller_profiles WHERE seller_id IN ('+placeholders+')',accountIds],
    ['DELETE FROM marketplace_accounts WHERE id IN ('+placeholders+') AND email IN (?,?)',[...accountIds,...emails]],
    ['DELETE FROM marketplace_sellers WHERE id IN ('+placeholders+')',accountIds]
   ];
   for(const [sql,params] of steps)await query(preview,sql,params);
   const keys=[...emails.map(e=>'auth-email:'+e),...accountIds.map(id=>'listing:'+id)].map(v=>createHash('sha256').update(v).digest('hex'));
   await query(preview,'DELETE FROM marketplace_rate_limits WHERE key IN ('+keys.map(()=>'?').join(',')+')',keys);
  }
  const remainingAccounts=await query(preview,'SELECT COUNT(*) AS total FROM marketplace_accounts WHERE email IN (?,?)',emails);
  const remainingListing=listingId?await query(preview,'SELECT COUNT(*) AS total FROM marketplace_listings WHERE id=?',[listingId]):[{total:0}];
  report.cleanup={temporaryAccountsRemaining:Number(remainingAccounts[0].total),temporaryListingsRemaining:Number(remainingListing[0].total),previewCountsBefore:previewBefore[0],previewCountsAfter:(await counts(preview))[0]};
  assert.equal(report.cleanup.temporaryAccountsRemaining,0);assert.equal(report.cleanup.temporaryListingsRemaining,0);
  const productionAfter=await counts(production);report.productionPreserved=JSON.stringify(productionBefore)===JSON.stringify(productionAfter);
  assert(report.productionPreserved,'As contagens oficiais mudaram durante a execução; investigar alterações concorrentes.');
 }catch(error){report.cleanupError=error instanceof Error?error.message:'Limpeza não confirmada.';problem=problem||'Limpeza não confirmada.'}
}
report.passed=!problem;
if(problem)report.failure=problem;
console.log('IDOR_REPORT '+JSON.stringify(report));
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'## Teste real autorizado de isolamento\n\n```json\n'+JSON.stringify(report,null,2)+'\n```\n');
if(problem)process.exitCode=1;
