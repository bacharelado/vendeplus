// Migração incremental da funcionalidade de vídeo. Nunca altera contas ou anúncios.
const ACCOUNT_ID='3466eb459952187515061f97996a9a17';
const PROJECT='vendeplus';
const REF='refs/heads/feat/seller-dashboard-video-20261116';
if(process.env.GITHUB_REF!==REF)throw Error('Ação bloqueada: branch não autorizada.');
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token||/[\r\n]/.test(token))throw Error('CLOUDFLARE_API_TOKEN indisponível.');
const base='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT_ID;
async function api(path,method='GET',body){
 const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(30000)});
 const data=await response.json();
 if(!response.ok||data.success!==true)throw Error('Cloudflare recusou '+method+' '+path.split('?')[0]+' (HTTP '+response.status+')');
 return data.result;
}
function assert(condition,message){if(!condition)throw Error(message)}
async function query(id,sql){
 const result=await api('/d1/database/'+id+'/query','POST',{sql});
 assert(Array.isArray(result)&&result.length>0&&result.every(x=>x.success===true),'Consulta ou alteração de D1 não confirmada.');
 return result[0].results||[];
}
async function inspect(id){
 const fields=(await query(id,"SELECT name FROM pragma_table_info('marketplace_listings')")).map(x=>x.name);
 assert(fields.includes('id')&&fields.includes('seller_id')&&fields.includes('status'),'Tabela de anúncios ausente ou não reconhecida.');
 const count=(await query(id,"SELECT count(*) AS total FROM marketplace_listings"))[0]?.total;
 assert(Number.isSafeInteger(Number(count)),'Não foi possível contar anúncios.');
 return {hasVideo:fields.includes('video_id'),total:Number(count)};
}
const project=await api('/pages/projects/'+PROJECT);
assert(project.name===PROJECT&&project.production_branch==='main','Projeto de produção inesperado.');
const ids=Object.fromEntries(['preview','production'].map(env=>[env,project.deployment_configs?.[env]?.d1_databases?.MARKETPLACE_DB?.id]));
assert(ids.preview&&ids.production&&ids.preview!==ids.production,'Bancos ausentes ou compartilhados. Nenhuma alteração realizada.');
const dbs=await Promise.all(['preview','production'].map(async(env)=>({env,id:ids[env],db:await api('/d1/database/'+ids[env])})));
for(const item of dbs)assert(item.db.uuid===item.id&&item.db.name===('vendeplus-'+item.env),'Nome ou ID de D1 não corresponde ao ambiente '+item.env);
for(const env of ['preview','production']){
 const id=ids[env];
 const prior=await inspect(id);
 const bookmark=await api('/d1/database/'+id+'/time_travel/bookmark');
 assert(typeof bookmark?.bookmark==='string'&&bookmark.bookmark.length>10,'Sem ponto de recuperação D1 para '+env+'. Alteração bloqueada.');
 console.log(JSON.stringify({environment:env,step:'preflight',listingCount:prior.total,timeTravelBookmark:bookmark.bookmark,alreadyMigrated:prior.hasVideo}));
 if(!prior.hasVideo){
  await query(id,"ALTER TABLE marketplace_listings ADD COLUMN video_id TEXT CHECK(video_id IS NULL OR (length(video_id)=11 AND video_id NOT GLOB '*[^A-Za-z0-9_-]*'))");
 }
 const after=await inspect(id);
 assert(after.hasVideo&&after.total===prior.total,'Falha de verificação de estrutura/contagem em '+env);
 const integrity=await query(id,'PRAGMA quick_check');
 assert(integrity.length===1&&Object.values(integrity[0]).includes('ok'),'PRAGMA quick_check falhou em '+env);
 const foreign=await query(id,'PRAGMA foreign_key_check');
 assert(foreign.length===0,'PRAGMA foreign_key_check falhou em '+env);
 console.log(JSON.stringify({environment:env,step:'verified',listingCount:after.total,migrated:true}));
}
async function health(url){
 const response=await fetch(url+'/api/listings',{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});
 assert(response.ok,'API pública indisponível em '+url);
 const value=await response.json();
 assert(Array.isArray(value.listings),'Formato inesperado do catálogo em '+url);
 console.log(JSON.stringify({url,ok:true,listingCount:value.listings.length}));
}
await health('https://vendeplus.pages.dev');
const deployments=await api('/pages/projects/'+PROJECT+'/deployments?env=preview&per_page=100');
const branch=process.env.GITHUB_REF.split('/').at(-1);
const preview=Array.isArray(deployments)?deployments.find(item=>item.environment==='preview'&&item.deployment_trigger?.metadata?.branch===branch&&item.latest_stage?.status==='success'):null;
if(preview?.url)await health(new URL(preview.url).origin);
else console.log('Prévia para esta branch ainda não localizada; produção e schema foram verificados.');
console.log('Migração incremental D1 concluída sem modificar linhas existentes.');
