import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {accountId,projectName,publicPreviewUrl} from './connect-preview-database.mjs';
export const validatedCommit='a74415e3f853b5edad6afcdd2380153b5b4b44a0';
const cutoff='2026-11-11T03:19:59.135011Z';
const protectedId='5165922d-4026-456d-a0e0-0624ec657718';
export function obsoletePreviews(deployments,canonical){
 return deployments.filter(d=>d.environment==='preview'&&d.id!==canonical&&d.id!==protectedId&&d.deployment_trigger?.metadata?.branch==='feat/cloudinary-fotos-free'&&d.deployment_trigger?.metadata?.commit_hash!==validatedCommit&&Number.isFinite(Date.parse(d.created_on))&&Date.parse(d.created_on)<Date.parse(cutoff)&&d.latest_stage?.name==='deploy'&&d.latest_stage.status==='success');
}
async function main(){
 const token=process.env.CLOUDFLARE_API_TOKEN,githubToken=process.env.GITHUB_TOKEN;
 if(!token||!githubToken||process.env.GITHUB_REF!=='refs/heads/feat/cloudinary-fotos-free')throw Error('Contexto da limpeza não autorizado.');
 const runResponse=await fetch('https://api.github.com/repos/bacharelado/vendeplus/actions/runs?head_sha='+validatedCommit+'&per_page=100',{headers:{Authorization:'Bearer '+githubToken,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(25000)});
 if(!runResponse.ok)throw Error('Não foi possível confirmar os testes antes da limpeza.');
 const runs=(await runResponse.json()).workflow_runs;
 if(!runs.some(r=>r.name==='VENDE+ — Fotos reais na prévia'&&r.head_sha===validatedCommit&&r.conclusion==='success'))throw Error('Auditoria real do commit de recuperação não aprovada.');
 async function api(path,method='GET',body){
  const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+accountId+path,{method,redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
  const value=await r.json();if(!r.ok||!value.success)throw Error('Cloudflare HTTP '+r.status+' — operação não confirmada.');return value.result;
 }
 const projectPath='/pages/projects/'+projectName,before=await api(projectPath);
 if(before.name!==projectName||before.production_branch!=='main'||!before.canonical_deployment?.id)throw Error('Produção não identificada.');
 const recovery=await api(projectPath+'/deployments?per_page=100');
 if(!recovery.some(d=>d.environment==='preview'&&d.deployment_trigger?.metadata?.commit_hash===validatedCommit&&d.latest_stage?.name==='deploy'&&d.latest_stage.status==='success'))throw Error('Deploy de recuperação validado ausente.');
 const databases=[...new Set(Object.values(before.deployment_configs).flatMap(c=>Object.values(c.d1_databases||{}).map(b=>b.id)))];
 if(databases.length<2)throw Error('Bancos isolados não confirmados.');
 const all=[];
 for(let page=1;page<=20;page++){
  const rows=await api(projectPath+'/deployments?per_page=100&page='+page);all.push(...rows);
  if(rows.length<100)break;
  if(page===20)throw Error('Lista de deploys incompleta.');
 }
 const report={validatedCommit,deleted:[],preserved:[],productionDeployment:before.canonical_deployment.id};
 for(const candidate of obsoletePreviews(all,before.canonical_deployment.id)){
  const origin=publicPreviewUrl(candidate.url);
  let references=0;
  for(const database of databases){
   const result=await api('/d1/database/'+database+'/query','POST',{sql:'SELECT COUNT(*) AS total FROM marketplace_listings WHERE image_url LIKE ?',params:[origin+'/%']});
   if(!result?.[0]?.success)throw Error('Referências às fotos não confirmadas.');
   references+=Number(result[0].results[0].total);
  }
  if(references){report.preserved.push({id:candidate.id,reason:'referenced_images'});continue;}
  const fresh=await api(projectPath),detail=await api(projectPath+'/deployments/'+candidate.id);
  if(fresh.canonical_deployment.id!==before.canonical_deployment.id||fresh.production_branch!=='main')throw Error('A produção mudou durante a limpeza.');
  if(!obsoletePreviews([detail],fresh.canonical_deployment.id).length)throw Error('Deploy deixou de ser elegível.');
  // No force: aliases and any additional provider protections remain enforced.
  try{await api(projectPath+'/deployments/'+candidate.id,'DELETE');report.deleted.push(candidate.id)}
  catch{report.preserved.push({id:candidate.id,reason:'provider_protection_or_unconfirmed'})}
 }
 const after=await api(projectPath);
 if(after.canonical_deployment.id!==before.canonical_deployment.id||JSON.stringify(after.deployment_configs)!==JSON.stringify(before.deployment_configs))throw Error('Estado de produção alterado externamente; revisar antes de continuar.');
 report.productionPreserved=true;
 await mkdir('artifacts/cleanup-preview',{recursive:true});
 await writeFile('artifacts/cleanup-preview/report.json',JSON.stringify(report,null,2));
 console.log('PREVIEW_CLEANUP '+JSON.stringify(report));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){main().catch(error=>{console.error(error.message);process.exitCode=1})}
