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
console.log(JSON.stringify({repositoryCloudinarySecrets:{apiKey:!!process.env.GH_CLOUDINARY_API_KEY,apiSecret:!!process.env.GH_CLOUDINARY_API_SECRET}}));
for(const environment of ['preview','production']){
 const config=project.deployment_configs?.[environment]||{};
 const binding=config.d1_databases?.MARKETPLACE_DB?.id;
 summaries[environment]={databaseBound:!!binding,compatibilityDate:config.compatibility_date,flags:config.compatibility_flags,
  cloudinary:Object.fromEntries(['CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET'].map(k=>[k,!!config.env_vars?.[k]])),
  cloudinaryValuesReadable:Object.fromEntries(['CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET'].map(k=>[k,!!config.env_vars?.[k]?.value&&!/^([*]+|\[redacted\])$/i.test(config.env_vars[k].value)]))};
 if(binding){
  const db=await api('/d1/database/'+binding);
  summaries[environment].databaseName=db?.name;
  const schema=await api('/d1/database/'+binding+'/query',{sql:"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"});
  summaries[environment].tables=schema?.[0]?.results?.map(r=>r.name);
  const integrity=await api('/d1/database/'+binding+'/query',{sql:'PRAGMA quick_check; PRAGMA foreign_key_check;'});
  summaries[environment].integrity=integrity?.map((r,i)=>({check:i===0?'quick_check':'foreign_key_check',success:r.success,rows:r.results?.length,ok:i===0?r.results?.length===1&&Object.values(r.results[0]).includes('ok'):r.results?.length===0}));
 }
}
console.log(JSON.stringify({project:project.name,productionBranch:project.production_branch,isolatedDatabases:!!project.deployment_configs.preview.d1_databases?.MARKETPLACE_DB?.id&&project.deployment_configs.preview.d1_databases.MARKETPLACE_DB.id!==project.deployment_configs.production.d1_databases?.MARKETPLACE_DB?.id,environments:summaries}));
const deployments=await api('/pages/projects/'+projectName+'/deployments?per_page=10');
console.log(JSON.stringify({deployments:deployments?.map(d=>({id:d.id,environment:d.environment,created:d.created_on,stage:d.latest_stage,branch:d.deployment_trigger?.metadata?.branch,commit:d.deployment_trigger?.metadata?.commit_hash,url:d.url,canonical:d.id===project.canonical_deployment?.id}))}));
const buildId='d32e5828-17df-49f4-a540-66175afee083';
const build=await api('/builds/builds/'+buildId);
if(build)console.log(JSON.stringify({workerBuild:{uuid:build.uuid,status:build.status,buildOutcome:build.build_outcome,deployOutcome:build.deploy_outcome,trigger:build.build_trigger_uuid,metadataKeys:Object.keys(build.build_trigger_metadata||{}),rootDirectory:build.build_trigger_metadata?.root_directory,buildIsBareCommand:build.build_trigger_metadata?.build_command==='build',buildIsNpm:build.build_trigger_metadata?.build_command==='npm run build',deployIsWrangler:build.build_trigger_metadata?.deploy_command==='npx wrangler deploy'}}));
const logs=await api('/builds/builds/'+buildId+'/logs');
if(logs){
 const text=JSON.stringify(logs);
 const known=['Missing entry-point','Missing entry point','assets directory','wrangler deploy','wrangler pages deploy','Authentication error','Unauthorized','Could not resolve','Build failed','Deploy failed','No such file','not found','Missing script','build: not found','npm: not found','wrangler: not found','vite: not found','yarn: not found','npm run build','npx wrangler deploy','Command failed','exit code 127','build: command not found','npm: command not found','wrangler: command not found','tsc: not found','tsc: command not found','ENOENT','Could not read package.json','Cannot find module','npm error','Failed:'];
 console.log(JSON.stringify({workerBuildEvidence:known.filter(s=>text.toLowerCase().includes(s.toLowerCase())),lines:logs.lines?.length,truncated:logs.truncated}));
 const secrets=[token,process.env.GH_CLOUDINARY_API_KEY,process.env.GH_CLOUDINARY_API_SECRET,...Object.values(project.deployment_configs).flatMap(c=>Object.values(c.env_vars||{}).map(v=>v?.value))].filter(v=>typeof v==='string'&&v.length>3);
 const redact=value=>{
  let safe=value;
  for(const secret of secrets)safe=safe.replaceAll(secret,'[REDACTED]');
  return safe.replace(/https?:\/\/[^\s"\\]+/g,'[URL]').replace(/[A-Za-z0-9_-]{24,}/g,'[REDACTED]').replace(/\b\d{12,}\b/g,'[REDACTED]').replace(/(Bearer|Basic)\s+\S+/gi,'$1 [REDACTED]');
 };
 console.log(JSON.stringify({workerFailureLines:(logs.lines||[]).map(l=>typeof l==='string'?l:JSON.stringify(l)).filter(l=>/not found|Failed:|ERROR/i.test(l)).slice(0,10).map(redact)}));
}
