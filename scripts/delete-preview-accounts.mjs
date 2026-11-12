import {appendFile} from 'node:fs/promises';
import {accountId,projectName} from './connect-preview-database.mjs';
if(process.env.GITHUB_REF!=='refs/heads/ops/excluir-contas-previa-20261112'||process.env.GITHUB_RUN_ATTEMPT!=='1')throw Error('Execução não autorizada para esta referência ou repetição.');
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token)throw Error('Acesso indisponível.');
const root='https://api.cloudflare.com/client/v4/accounts/'+accountId;
async function api(path,body){
 const r=await fetch(root+path,{method:body?'POST':'GET',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
 const data=await r.json();
 if(!r.ok||!data.success||Array.isArray(data.result)&&data.result.some(x=>x.success===false))throw Error('Operação não concluída. HTTP '+r.status);
 return data.result;
}
const project=await api('/pages/projects/'+projectName);
const preview=project.deployment_configs?.preview?.d1_databases?.MARKETPLACE_DB?.id;
const production=project.deployment_configs?.production?.d1_databases?.MARKETPLACE_DB?.id;
if(project.name!==projectName||!preview||!production||preview===production)throw Error('Separação entre ambientes não confirmada.');
const database=await api('/d1/database/'+preview);
if(database.name!=='vendeplus-preview')throw Error('Banco de prévia não confirmado.');
const read=async(id,sql,params=[])=>{const result=await api('/d1/database/'+id+'/query',{sql,params});return result[0].results};
const productionBefore=Number((await read(production,'SELECT COUNT(*) AS total FROM marketplace_accounts'))[0].total);
const targets=await read(preview,'SELECT id FROM marketplace_accounts WHERE created_at<=?', [1794497671]);
const total=Number((await read(preview,'SELECT COUNT(*) AS total FROM marketplace_accounts'))[0].total);
if(total!==2||targets.length!==2||targets.some(x=>typeof x.id!=='string'||!/^[a-f0-9-]{36}$/i.test(x.id)))throw Error('As duas contas esperadas não foram confirmadas; nenhum dado excluído.');
const ids=targets.map(x=>x.id);
const inAccounts='IN (?,?)';
const listings='IN (SELECT id FROM marketplace_listings WHERE seller_id '+inAccounts+')';
const statements=[
 ['DELETE FROM marketplace_reports WHERE listing_id '+listings+' OR resolved_by '+inAccounts,[...ids,...ids]],
 ['DELETE FROM marketplace_moderation_log WHERE listing_id '+listings+' OR admin_id '+inAccounts,[...ids,...ids]],
 ['DELETE FROM marketplace_seller_reviews WHERE seller_id '+inAccounts+' OR admin_id '+inAccounts,[...ids,...ids]],
 ['DELETE FROM marketplace_listing_events WHERE listing_id '+listings+' OR seller_id '+inAccounts,[...ids,...ids]],
 ['DELETE FROM marketplace_listing_details WHERE listing_id '+listings+' OR seller_id '+inAccounts,[...ids,...ids]],
 ['DELETE FROM marketplace_listings WHERE seller_id '+inAccounts,ids],
 ['DELETE FROM marketplace_sessions WHERE account_id '+inAccounts,ids],
 ['DELETE FROM marketplace_seller_profiles WHERE seller_id '+inAccounts,ids],
 ['DELETE FROM marketplace_accounts WHERE id '+inAccounts,ids],
 ['DELETE FROM marketplace_sellers WHERE id '+inAccounts,ids]
];
for(const [sql,params] of statements)await api('/d1/database/'+preview+'/query',{sql,params});
const previewAfter=Number((await read(preview,'SELECT COUNT(*) AS total FROM marketplace_accounts'))[0].total);
const remainingTargets=Number((await read(preview,'SELECT COUNT(*) AS total FROM marketplace_accounts WHERE id IN (?,?)',ids))[0].total);
const productionAfter=Number((await read(production,'SELECT COUNT(*) AS total FROM marketplace_accounts'))[0].total);
if(remainingTargets!==0)throw Error('Exclusão incompleta.');
const summary={deletedPreviewAccounts:2,previewAccounts:previewAfter,productionAccountsBefore:productionBefore,productionAccountsAfter:productionAfter,isolatedDatabases:true};
console.log(JSON.stringify(summary));
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'## Exclusão autorizada das duas contas da prévia\n\n```json\n'+JSON.stringify(summary,null,2)+'\n```\n');
