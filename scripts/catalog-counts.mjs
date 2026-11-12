import {appendFile} from 'node:fs/promises';
import {accountId,projectName} from './connect-preview-database.mjs';
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token)throw Error('Acesso ao diagnóstico indisponível.');
async function call(path,sql){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+accountId+path,{method:sql?'POST':'GET',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(sql?{body:JSON.stringify({sql})}:{}),signal:AbortSignal.timeout(25000)});
 const data=await r.json();
 if(!r.ok||!data.success)throw Error('Não foi possível consultar as contagens. HTTP '+r.status);
 return data.result;
}
const project=await call('/pages/projects/'+projectName);
const summary={};
for(const name of ['production','preview']){
 const id=project.deployment_configs?.[name]?.d1_databases?.MARKETPLACE_DB?.id;
 if(!id){summary[name]={databaseBound:false};continue}
 const result=await call('/d1/database/'+id+'/query',`SELECT 'total' AS state,COUNT(*) AS total FROM marketplace_listings UNION ALL SELECT l.status,COUNT(*) FROM marketplace_listings l GROUP BY l.status UNION ALL SELECT 'public_visible',COUNT(*) FROM marketplace_listings l JOIN marketplace_sellers s ON s.id=l.seller_id WHERE l.status='published' AND s.status!='suspended'`);
 summary[name]={databaseBound:true,counts:result[0]?.results};
}
const text=JSON.stringify(summary,null,2);
console.log(text);
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'## Contagens do catálogo\n\n```json\n'+text+'\n```\n');
