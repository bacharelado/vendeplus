import {accountId,projectName} from './connect-preview-database.mjs';
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token)throw Error('Segredo de acesso Cloudflare indisponível.');
const root='/accounts/'+accountId;
async function api(path,body){
 const response=await fetch('https://api.cloudflare.com/client/v4'+root+path,{
  method:body?'POST':'GET',redirect:'error',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)
 });
 const data=await response.json();
 if(!response.ok||!data.success){console.log(JSON.stringify({operation:path.split('?')[0],http:response.status,codes:data.errors?.map(e=>e.code)}));return null;}
 return data.result;
}
const project=await api('/pages/projects/'+projectName);
if(!project||project.name!==projectName)throw Error('Projeto não confirmado.');
const summaries={};
for(const environment of ['preview','production']){
 const config=project.deployment_configs?.[environment]||{};
 const binding=config.d1_databases?.MARKETPLACE_DB?.id;
 summaries[environment]={databaseBound:!!binding,compatibilityDate:config.compatibility_date,flags:config.compatibility_flags,
  cloudinary:Object.fromEntries(['CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET'].map(k=>[k,!!config.env_vars?.[k]]))};
 if(binding){
  const db=await api('/d1/database/'+binding);
  summaries[environment].databaseName=db?.name;
  const schema=await api('/d1/database/'+binding+'/query',{sql:"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"});
  summaries[environment].tables=schema?.[0]?.results?.map(r=>r.name);
 }
}
console.log(JSON.stringify({project:project.name,productionBranch:project.production_branch,isolatedDatabases:!!project.deployment_configs.preview.d1_databases?.MARKETPLACE_DB?.id&&project.deployment_configs.preview.d1_databases.MARKETPLACE_DB.id!==project.deployment_configs.production.d1_databases?.MARKETPLACE_DB?.id,environments:summaries}));
const deployments=await api('/pages/projects/'+projectName+'/deployments?per_page=10');
console.log(JSON.stringify({deployments:deployments?.map(d=>({id:d.id,environment:d.environment,created:d.created_on,stage:d.latest_stage,branch:d.deployment_trigger?.metadata?.branch,commit:d.deployment_trigger?.metadata?.commit_hash,url:d.url,canonical:d.id===project.canonical_deployment?.id}))}));
const buildId='d32e5828-17df-49f4-a540-66175afee083';
const build=await api('/builds/builds/'+buildId);
if(build)console.log(JSON.stringify({workerBuild:{uuid:build.uuid,status:build.status,buildOutcome:build.build_outcome,deployOutcome:build.deploy_outcome}}));
const logs=await api('/builds/builds/'+buildId+'/logs');
if(logs){
 const text=JSON.stringify(logs);
 const known=['Missing entry-point','Missing entry point','assets directory','wrangler deploy','wrangler pages deploy','Authentication error','Unauthorized','Could not resolve','Build failed','Deploy failed','No such file','not found','Missing script'];
 console.log(JSON.stringify({workerBuildEvidence:known.filter(s=>text.toLowerCase().includes(s.toLowerCase())),lines:logs.lines?.length,truncated:logs.truncated}));
}
