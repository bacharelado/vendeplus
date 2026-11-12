import {readFile} from 'node:fs/promises';
import {accountId,projectName} from './connect-preview-database.mjs';
if(process.env.GITHUB_REF!=='refs/heads/main')throw Error('Execute somente na branch main após revisão.');
const target=process.env.PASSWORD_RESET_TARGET;
if(target!=='preview'&&target!=='production')throw Error('Escolha explicitamente preview ou production.');
if(target==='production'&&process.env.CONFIRM_PASSWORD_RESET_PRODUCTION!=='APLICAR_MIGRACAO_0004')throw Error('Confirmação explícita de produção ausente.');
const token=process.env.CLOUDFLARE_API_TOKEN;if(!token)throw Error('Acesso Cloudflare indisponível.');
const sql=await readFile(new URL('../migrations/0004_password_resets.sql',import.meta.url),'utf8');
const statements=sql.split(';').map(s=>s.trim()).filter(Boolean);
if(statements.length!==3||!statements.every(s=>/^CREATE (TABLE|INDEX) IF NOT EXISTS marketplace_password_resets(?:_[a-z]+)?\b/.test(s)))throw Error('Migração não permitida.');
async function api(path,body){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+accountId+path,{method:body?'POST':'GET',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
 const data=await r.json();if(!r.ok||!data.success||Array.isArray(data.result)&&data.result.some(x=>x.success===false))throw Error('Operação não confirmada. HTTP '+r.status);return data.result;
}
const project=await api('/pages/projects/'+projectName);
const preview=project.deployment_configs?.preview?.d1_databases?.MARKETPLACE_DB?.id,production=project.deployment_configs?.production?.d1_databases?.MARKETPLACE_DB?.id;
if(project.name!==projectName||!preview||!production||preview===production)throw Error('Bancos separados não confirmados.');
for(const [name,id,expected] of [[target,target==='preview'?preview:production,target==='preview'?'vendeplus-preview':'vendeplus-production']]){
 const db=await api('/d1/database/'+id);if(db.name!==expected)throw Error('Nome do banco inesperado.');
 const before=await api('/d1/database/'+id+'/query',{sql:'SELECT COUNT(*) AS total FROM marketplace_accounts'});
 await api('/d1/database/'+id+'/query',{sql});
 const after=await api('/d1/database/'+id+'/query',{sql:'SELECT COUNT(*) AS total FROM marketplace_accounts'});
 const ready=await api('/d1/database/'+id+'/query',{sql:"SELECT name FROM sqlite_master WHERE type='table' AND name='marketplace_password_resets'"});
 const config=project.deployment_configs[name].env_vars||{};
 console.log(JSON.stringify({environment:name,migrationReady:ready[0]?.results?.length===1,accountsPreserved:before[0].results[0].total===after[0].results[0].total,emailConfigured:Boolean(config.RESEND_API_KEY&&config.PASSWORD_RESET_FROM&&config.PASSWORD_RESET_ENABLED)}));
}
