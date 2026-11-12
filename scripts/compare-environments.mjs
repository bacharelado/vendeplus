import {createHash} from 'node:crypto';
import {accountId,projectName} from './connect-preview-database.mjs';
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token)throw Error('Acesso indisponível.');
async function api(path,sql){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+accountId+path,{method:sql?'POST':'GET',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(sql?{body:JSON.stringify({sql})}:{}),signal:AbortSignal.timeout(25000)});
 const data=await r.json();if(!r.ok||!data.success)throw Error('Consulta falhou HTTP '+r.status);return data.result;
}
const project=await api('/pages/projects/'+projectName);
let deployments=await api('/pages/projects/'+projectName+'/deployments?per_page=25');
for(let attempt=0;attempt<10;attempt++){
 if(deployments.some(d=>d.environment==='preview'&&d.deployment_trigger?.metadata?.branch==='feat/ux-compra-venda-v2'&&d.deployment_trigger?.metadata?.commit_hash==='ec0ca021488b6f3ecd3ca191c1c74f8b32bdb2e2'&&d.latest_stage?.status==='success'))break;
 await new Promise(resolve=>setTimeout(resolve,5000));
 deployments=await api('/pages/projects/'+projectName+'/deployments?per_page=25');
}
const configs={};
for(const name of ['production','preview']){
 const c=project.deployment_configs?.[name]||{};
 const id=c.d1_databases?.MARKETPLACE_DB?.id;
 const schema=id?await api('/d1/database/'+id+'/query',"SELECT name,sql FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type,name"):null;
 const rows=schema?.[0]?.results||[];
 const totals=id?await api('/d1/database/'+id+'/query',"SELECT (SELECT COUNT(*) FROM marketplace_accounts) AS accounts,(SELECT COUNT(*) FROM marketplace_listings) AS listings,(SELECT COUNT(*) FROM marketplace_listings l JOIN marketplace_sellers s ON s.id=l.seller_id WHERE l.status='published' AND s.status!='suspended') AS visible"):null;
 configs[name]={compatibilityDate:c.compatibility_date,flags:c.compatibility_flags,envKeys:Object.keys(c.env_vars||{}).sort(),d1Keys:Object.keys(c.d1_databases||{}),r2Keys:Object.keys(c.r2_buckets||{}),schemaHash:createHash('sha256').update(JSON.stringify(rows)).digest('hex'),tables:rows.filter(x=>x.sql?.startsWith('CREATE TABLE')).map(x=>x.name),counts:totals?.[0]?.results?.[0]};
}
console.log('RECON_CONFIG '+JSON.stringify({productionBranch:project.production_branch,sourceConfig:project.source?.config,buildConfig:project.build_config,isolatedDatabases:project.deployment_configs?.preview?.d1_databases?.MARKETPLACE_DB?.id!==project.deployment_configs?.production?.d1_databases?.MARKETPLACE_DB?.id,configs}));
console.log('RECON_DEPLOYMENTS '+JSON.stringify(deployments.map(d=>({id:d.id,environment:d.environment,stage:d.latest_stage,branch:d.deployment_trigger?.metadata?.branch,commit:d.deployment_trigger?.metadata?.commit_hash,url:d.url,aliases:d.aliases,canonical:d.id===project.canonical_deployment?.id}))));
const expectedPreviewBranch=process.env.COMPARE_PREVIEW_BRANCH||'feat/ux-compra-venda-v2';
const production=deployments.find(d=>d.id===project.canonical_deployment?.id);
const preview=deployments.find(d=>d.environment==='preview'&&d.deployment_trigger?.metadata?.branch===expectedPreviewBranch&&d.latest_stage?.status==='success');
async function probe(deploy){
 if(!deploy)return {available:false};
 const origin=new URL(deploy.url).origin;
 if(!/^https:\/\/[-a-z0-9]+\.vendeplus\.pages\.dev$/.test(origin))throw Error('Origem de publicação inválida.');
 const r=await fetch(origin+'/',{redirect:'error',signal:AbortSignal.timeout(15000)});const html=await r.text();
 const files=[...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map(x=>x[1]);
 const assets=[];
 for(const path of files){const a=await fetch(origin+path,{redirect:'error',signal:AbortSignal.timeout(15000)});assets.push({path,status:a.status,sha:createHash('sha256').update(Buffer.from(await a.arrayBuffer())).digest('hex')})}
 const routes=[];
 for(const path of ['/api/listings','/api/media-upload','/api/account/session','/api/account/admin/stats']){
 const x=await fetch(origin+path,{redirect:'error',signal:AbortSignal.timeout(15000)});const type=x.headers.get('content-type');let data;try{data=await x.json()}catch{}
 routes.push({path,status:x.status,type,listingCount:Array.isArray(data?.listings)?data.listings.length:undefined,photoAvailable:data?.available,anonymous:data?.account===null,adminDenied:path.endsWith('/admin/stats')?x.status===401||x.status===403:undefined});
 }
 return {available:true,origin,branch:deploy.deployment_trigger?.metadata?.branch,commit:deploy.deployment_trigger?.metadata?.commit_hash,htmlStatus:r.status,htmlHash:createHash('sha256').update(html).digest('hex'),assets,routes};
}
console.log('RECON_PROBES '+JSON.stringify({production:await probe(production),preview:await probe(preview)}));
