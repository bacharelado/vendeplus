import {pathToFileURL} from 'node:url';

const repo='bacharelado/vendeplus';
const checks=[['quality.yml','verificar'],['playwright.yml','Playwright — computador e celular']];
export async function verifyProductionBuild(env,fetchImpl=fetch){
 if(!env.CF_PAGES)return;
 if(env.CF_PAGES!=='1'||!env.CF_PAGES_BRANCH)throw Error('Ambiente Pages incompleto.');
 if(env.CF_PAGES_BRANCH!=='main')return;
 const sha=env.CF_PAGES_COMMIT_SHA;
 if(!/^[a-f0-9]{40}$/.test(sha||'')||env.VENDEPLUS_APPROVED_PRODUCTION_SHA!==sha)
   throw Error('Produção bloqueada. Autorize manualmente o SHA exato depois da revisão.');
 async function read(path){
  const response=await fetchImpl('https://api.github.com/repos/'+repo+'/actions/'+path,{redirect:'error',
   headers:{Accept:'application/vnd.github+json','User-Agent':'vendeplus-pages-release'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Não foi possível verificar o GitHub. Produção bloqueada.');
  return response.json();
 }
 for(const [workflow,jobName] of checks){
  const data=await read('workflows/'+workflow+'/runs?branch=main&event=push&per_page=1&head_sha='+sha);
  const run=data.workflow_runs?.[0];
  if(run?.head_sha!==sha||run.head_branch!=='main'||run.event!=='push'||run.head_repository?.full_name!==repo||
     run.path!=='.github/workflows/'+workflow||run.status!=='completed'||run.conclusion!=='success'||
     !Number.isSafeInteger(run.id)||!Number.isSafeInteger(run.run_attempt))throw Error('Aguardando aprovação de '+workflow+' no SHA de produção.');
  const jobs=await read('runs/'+run.id+'/attempts/'+run.run_attempt+'/jobs');
  if(!jobs.jobs?.some(j=>j.head_sha===sha&&j.name===jobName&&j.status==='completed'&&j.conclusion==='success'))
    throw Error('O job '+jobName+' precisa passar neste SHA.');
 }
 return sha;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{await verifyProductionBuild(process.env)}catch(error){console.error(error.message);process.exitCode=1}
}
