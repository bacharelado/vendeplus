import {readFile,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {accountId,projectName,branchName} from './connect-preview-database.mjs';
const databaseName='vendeplus-production';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export async function prepareProduction({token,ref,migration,fetchImpl=fetch,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 if(ref!=='refs/heads/'+branchName)throw Error('Preparação autorizada somente pela branch de desenvolvimento.');
 if(!token||/[\r\n]/.test(token))throw Error('Acesso Cloudflare ausente.');
 const statements=String(migration||'').split(';').map(s=>s.trim()).filter(Boolean);
 if(!statements.length||!statements.every(s=>/^(CREATE (TABLE|INDEX) IF NOT EXISTS\b|PRAGMA foreign_keys=ON$)/i.test(s))||!migration.includes('CREATE TABLE IF NOT EXISTS marketplace_accounts'))throw Error('Somente criação incremental das tabelas é permitida.');
 const root='/accounts/'+accountId,projectPath=root+'/pages/projects/'+projectName;
 async function api(path,method='GET',body){
  let response,data;
  try{response=await fetchImpl('https://api.cloudflare.com/client/v4'+path,{method,redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});data=await response.json()}catch{throw Error('Não foi possível confirmar a operação na Cloudflare.');}
  if(!response.ok||!data.success)throw Error('Cloudflare recusou a preparação (HTTP '+response.status+'; códigos '+(data.errors||[]).map(e=>e.code).join(',')+').');
  return data.result;
 }
 const project=await api(projectPath);
 if(project.name!==projectName||project.production_branch!=='main'||!project.deployment_configs?.production||!project.deployment_configs?.preview)throw Error('O ambiente de produção não foi identificado.');
 const snapshot=stable(project.deployment_configs.production),canonical=project.canonical_deployment?.id;
 const previewIds=Object.values(project.deployment_configs.preview.d1_databases||{}).map(b=>b.id);
 const binding=project.deployment_configs.production.d1_databases?.MARKETPLACE_DB;
 let database;
 if(binding){
  if(previewIds.includes(binding.id))throw Error('Produção e prévia compartilham banco. Nenhuma alteração foi feita.');
  database=await api(root+'/d1/database/'+binding.id);
  if(database.name!==databaseName||database.uuid!==binding.id)throw Error('Já existe outro banco de produção. Nenhum binding será substituído.');
 }else{
  const found=await api(root+'/d1/database?name='+databaseName);
  const exact=found.filter(d=>d.name===databaseName);
  if(exact.length>1)throw Error('Mais de um banco corresponde ao lançamento.');
  database=exact[0];
  if(!database)database=await api(root+'/d1/database','POST',{name:databaseName});
 }
 if(database.name!==databaseName||!uuid.test(database.uuid)||previewIds.includes(database.uuid))throw Error('Banco exclusivo de produção não confirmado.');
 const latest=await api(projectPath);
 if(latest.production_branch!=='main'||stable(latest.deployment_configs.production)!==snapshot||latest.canonical_deployment?.id!==canonical)throw Error('A produção mudou durante a preparação. Execute novamente para revisar.');
 if(Object.values(latest.deployment_configs.preview.d1_databases||{}).some(b=>b.id===database.uuid))throw Error('O banco passou a ser usado pela prévia.');
 const result=await api(root+'/d1/database/'+database.uuid+'/query','POST',{sql:migration});
 if(!Array.isArray(result)||!result.length||result.some(r=>!r.success))throw Error('Migrações não foram confirmadas.');
 const schema=await api(root+'/d1/database/'+database.uuid+'/query','POST',{sql:"SELECT name FROM sqlite_master WHERE type='table'"});
 const names=schema?.[0]?.results?.map(r=>r.name)||[];
 if(!['marketplace_accounts','marketplace_sessions','marketplace_listings','marketplace_sellers','marketplace_reports'].every(n=>names.includes(n)))throw Error('As tabelas de produção não foram confirmadas.');
 const beforeBinding=await api(projectPath);
 if(stable(beforeBinding.deployment_configs.production)!==snapshot||beforeBinding.canonical_deployment?.id!==canonical||stable(beforeBinding.deployment_configs.preview)!==stable(latest.deployment_configs.preview))throw Error('A configuração mudou durante as migrações. Nenhum binding será substituído.');
 const current=latest.deployment_configs.production;
 const flags=[...new Set([...(current.compatibility_flags||[]),'nodejs_compat'])];
 const date=current.compatibility_date&&current.compatibility_date>'2025-04-08'?current.compatibility_date:'2025-04-08';
 if(!binding||!current.compatibility_flags?.includes('nodejs_compat')||current.compatibility_date!==date){
  await api(projectPath,'PATCH',{deployment_configs:{production:{d1_databases:{...(current.d1_databases||{}),MARKETPLACE_DB:{id:database.uuid}},compatibility_flags:flags,compatibility_date:date}}});
 }
 let status={};
 for(let attempt=0;attempt<6;attempt++){
  const final=await api(projectPath);
  status={branch:final.production_branch==='main',binding:final.deployment_configs.production.d1_databases?.MARKETPLACE_DB?.id===database.uuid,preview:stable(final.deployment_configs.preview)===stable(latest.deployment_configs.preview),deployment:final.canonical_deployment?.id===canonical};
  if(Object.values(status).every(Boolean))return {ready:true,databaseName,previewPreserved:true,productionDeploymentPreserved:true};
  if(!status.preview||!status.branch||!status.deployment)break;
  await sleep(1000);
 }
 throw Error('Preparação não confirmada: '+JSON.stringify(status));
}
async function main(){
 const files=(await readdir(new URL('../migrations/',import.meta.url))).filter(n=>/^\d{4}_[a-z0-9_]+\.sql$/.test(n)).sort();
 const migration=(await Promise.all(files.map(n=>readFile(new URL('../migrations/'+n,import.meta.url),'utf8')))).join('\n');
 console.log(JSON.stringify(await prepareProduction({token:process.env.CLOUDFLARE_API_TOKEN,ref:process.env.GITHUB_REF,migration})));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{await main()}catch(error){console.error(error.message);process.exitCode=1}}
