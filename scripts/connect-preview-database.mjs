import {readFile,readdir,appendFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export const accountId='3466eb459952187515061f97996a9a17';
export const projectName='vendeplus';
export const branchName='feat/vendeplus-2.0';
export const databaseName='vendeplus-preview';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const canonical=value=>JSON.stringify(value,(_,entry)=>entry&&typeof entry==='object'&&!Array.isArray(entry)?Object.fromEntries(Object.entries(entry).sort(([a],[b])=>a.localeCompare(b))):entry);
const deploymentBranch=value=>value?.deployment_trigger?.metadata?.branch;
const deploymentCommit=value=>value?.deployment_trigger?.metadata?.commit_hash;
const finished=value=>['failure','canceled','cancelled','skipped'].includes(value?.latest_stage?.status)||(value?.latest_stage?.name==='deploy'&&value?.latest_stage?.status==='success');

export function publicPreviewUrl(value){
  const url=new URL(value);
  if(url.protocol!=='https:'||!/^[-a-z0-9]+\.vendeplus\.pages\.dev$/.test(url.hostname)||url.username||url.password||url.port)throw new Error('O endereço retornado não é uma prévia do VENDE+.');
  return url.origin;
}

export async function connectPreviewDatabase({token,ref,commit,migration,fetchImpl=fetch,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),log=console.log,maxPolls=60}){
  if(ref!==`refs/heads/${branchName}`)throw new Error('Operação permitida somente na branch de desenvolvimento do VENDE+.');
  if(typeof token!=='string'||!token.trim()||/[\r\n]/.test(token))throw new Error('Adicione CLOUDFLARE_API_TOKEN aos segredos do repositório e execute novamente este job.');
  if(typeof commit!=='string'||!/^[a-f0-9]{40}$/i.test(commit))throw new Error('O commit da prévia não foi identificado.');
  if(typeof migration!=='string'||!migration.includes('CREATE TABLE IF NOT EXISTS marketplace_listings'))throw new Error('Migração do VENDE+ ausente.');
  const root=`/accounts/${accountId}`;
  const projectPath=`${root}/pages/projects/${projectName}`;
  const call=async(path,method='GET',body)=>{
    let response,data;
    try{
      response=await fetchImpl('https://api.cloudflare.com/client/v4'+path,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${token.trim()}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
      data=await response.json();
    }catch{throw new Error(`Não foi possível concluir ${method} na API Cloudflare. Nenhum token foi registrado.`)}
    if(!response.ok||data?.success!==true){
      const codes=Array.isArray(data?.errors)?data.errors.map(item=>item.code).filter(Number.isInteger).join(', '):'';
      const messages=Array.isArray(data?.errors)?data.errors.map(item=>typeof item.message==='string'?item.message.replaceAll(token.trim(),'[redigido]').slice(0,200):'').filter(Boolean).join('; '):'';
      const hint=[401,403].includes(response.status)?' Confira as permissões D1 e Cloudflare Pages do token.':'';
      throw new Error(`Cloudflare recusou ${method} ${path.split('?')[0]}: HTTP ${response.status}${codes?'; códigos '+codes:''}${messages?'; '+messages:''}.${hint}`);
    }
    return data;
  };
  const getProject=async()=>{
    const {result}=await call(projectPath);
    if(result?.name!==projectName||!result.deployment_configs?.production||!result.deployment_configs?.preview||!result.production_branch||!uuid.test(result.canonical_deployment?.id||''))throw new Error('Não foi possível confirmar o projeto VENDE+ e seus ambientes.');
    if(result.production_branch===branchName)throw new Error('A branch selecionada é de produção; nenhuma configuração será alterada.');
    return result;
  };
  const before=await getProject();
  const production=canonical(before.deployment_configs.production);
  const productionDeployment=before.canonical_deployment?.id;
  const ensureProduction=project=>{
    if(project.production_branch!==before.production_branch||canonical(project.deployment_configs.production)!==production||project.canonical_deployment?.id!==productionDeployment)throw new Error('A configuração de produção mudou durante a operação. Verifique o projeto antes de continuar.');
  };
  const existingBindings=before.deployment_configs.preview?.d1_databases||{};
  let database;
  for(let page=1;page<=20;page++){
    const response=await call(`${root}/d1/database?name=${encodeURIComponent(databaseName)}&per_page=100&page=${page}`);
    if(!Array.isArray(response.result))throw new Error('A lista de bancos retornou um formato inesperado.');
    const matches=response.result.filter(item=>item.name===databaseName);
    if(matches.length>1)throw new Error('Mais de um banco corresponde ao nome da prévia.');
    if(matches.length){database=matches[0];break}
    if(response.result.length<100||page>=Number(response.result_info?.total_pages||Infinity))break;
    if(page===20)throw new Error('Não foi possível concluir a verificação dos bancos existentes.');
  }
  if(database&&Object.values(before.deployment_configs.production?.d1_databases||{}).some(binding=>binding?.id===database.uuid))throw new Error('O banco encontrado está vinculado à produção. A migração foi bloqueada.');
  if(existingBindings.MARKETPLACE_DB&&(!database||existingBindings.MARKETPLACE_DB.id!==database.uuid))throw new Error('MARKETPLACE_DB já aponta para outro banco na prévia. Nenhuma substituição foi realizada.');
  if(!database){
    log('Criando banco exclusivo da prévia.');
    database=(await call(`${root}/d1/database`,'POST',{name:databaseName})).result;
  }else log('Reutilizando o banco já identificado para a prévia.');
  if(!uuid.test(database?.uuid||'')||database.name!==databaseName)throw new Error('O identificador do banco não pôde ser validado.');
  const latest=await getProject();
  ensureProduction(latest);
  if(Object.values(latest.deployment_configs.production?.d1_databases||{}).some(binding=>binding?.id===database.uuid))throw new Error('O banco está vinculado à produção. A migração foi bloqueada.');
  if(canonical(latest.deployment_configs.preview?.d1_databases||{})!==canonical(existingBindings))throw new Error('As vinculações da prévia mudaram. Execute novamente para revisar o estado atual.');
  log('Aplicando as tabelas sem inserir anúncios ou vendedores.');
  const queries=(await call(`${root}/d1/database/${database.uuid}/query`,'POST',{sql:migration})).result;
  if(!Array.isArray(queries)||!queries.length||queries.some(item=>item.success!==true))throw new Error('A migração não foi confirmada integralmente.');
  const schema=(await call(`${root}/d1/database/${database.uuid}/query`,'POST',{sql:"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('marketplace_sellers','marketplace_listings') ORDER BY name;"})).result;
  const names=schema?.[0]?.results?.map(row=>row.name)||[];
  if(!names.includes('marketplace_listings')||!names.includes('marketplace_sellers'))throw new Error('As tabelas não foram confirmadas no banco remoto.');
  const nodeRequired=migration.includes('CREATE TABLE IF NOT EXISTS marketplace_accounts');
  const previewConfig=before.deployment_configs.preview;
  const flags=[...new Set([...(previewConfig.compatibility_flags||[]),'nodejs_compat'])];
  const date=previewConfig.compatibility_date&&previewConfig.compatibility_date>'2025-04-08'?previewConfig.compatibility_date:'2025-04-08';
  if(existingBindings.MARKETPLACE_DB?.id!==database.uuid||nodeRequired&&(!previewConfig.compatibility_flags?.includes('nodejs_compat')||previewConfig.compatibility_date<date||!previewConfig.compatibility_date)){
    log('Vinculando MARKETPLACE_DB somente ao ambiente preview.');
    await call(projectPath,'PATCH',{deployment_configs:{preview:{d1_databases:{...existingBindings,MARKETPLACE_DB:{id:database.uuid}},...(nodeRequired?{compatibility_flags:flags,compatibility_date:date}:{})}}});
  }
  const bound=await getProject();ensureProduction(bound);
  if(bound.deployment_configs.preview?.d1_databases?.MARKETPLACE_DB?.id!==database.uuid)throw new Error('A vinculação da prévia não foi confirmada.');
  let target;
  for(let attempt=0;attempt<maxPolls;attempt++){
    const {result}=await call(`${projectPath}/deployments?env=preview`);
    if(!Array.isArray(result))throw new Error('Não foi possível consultar os deployments da prévia.');
    target=result.find(item=>item.environment==='preview'&&deploymentBranch(item)===branchName&&deploymentCommit(item)===commit);
    if(target&&finished(target))break;
    log('Aguardando o build da branch de desenvolvimento.');
    await sleep(5000);
  }
  const ensurePreview=value=>{
    if(value?.environment!=='preview'||deploymentBranch(value)!==branchName||deploymentCommit(value)!==commit||!uuid.test(value?.id||''))throw new Error('O deployment não corresponde à prévia e ao commit autorizados.');
  };
  ensurePreview(target);
  if(!finished(target))throw new Error('O build da prévia ainda não terminou. Execute novamente o job.');
  log('Recriando somente a prévia para ativar a vinculação do banco.');
  let deployment=(await call(`${projectPath}/deployments/${target.id}/retry`,'POST')).result;
  ensurePreview(deployment);
  for(let attempt=0;attempt<maxPolls&&!finished(deployment);attempt++){
    await sleep(5000);
    deployment=(await call(`${projectPath}/deployments/${deployment.id}`)).result;
    ensurePreview(deployment);
  }
  if(deployment.latest_stage?.name!=='deploy'||deployment.latest_stage?.status!=='success'){
    let diagnostics='';
    try{
      const logs=(await call(projectPath+'/deployments/'+deployment.id+'/history/logs')).result;
      const lines=Array.isArray(logs?.data)?logs.data.map(item=>String(item.line||'')).filter(line=>/error|failed|failure|exit code|exception/i.test(line)).slice(-8):[];
      diagnostics=lines.map(line=>line.replaceAll(token.trim(),'[redigido]').replace(/Bearer\s+\S+/gi,'Bearer [redigido]').slice(0,350)).join(' | ');
    }catch{diagnostics='Logs de build indisponíveis.'}
    throw new Error('A implantação da prévia falhou ('+String(deployment.latest_stage?.name||'stage')+'/'+String(deployment.latest_stage?.status||'unknown')+'). '+diagnostics);
  }
  const previewUrl=publicPreviewUrl(deployment.url);
  let catalog;
  for(let attempt=0;attempt<12;attempt++){
    try{
      const response=await fetchImpl(previewUrl+'/api/listings',{redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});
      const data=await response.json();
      if(response.ok&&Array.isArray(data.listings)){catalog=data.listings;break}
    }catch{}
    await sleep(5000);
  }
  if(!catalog)throw new Error('O banco foi vinculado, mas a API da prévia ainda não respondeu com o catálogo.');
  ensureProduction(await getProject());
  log(`Prévia conectada e API validada. ${catalog.length} anúncio(s) no catálogo.`);
  return {databaseName,previewUrl,listingCount:catalog.length,productionUnchanged:true};
}

async function main(){
  try{
    const files=(await readdir(new URL('../migrations/',import.meta.url))).filter(name=>/^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort();
    const migration=(await Promise.all(files.map(name=>readFile(new URL('../migrations/'+name,import.meta.url),'utf8')))).join('\n');
    const result=await connectPreviewDatabase({token:process.env.CLOUDFLARE_API_TOKEN,ref:process.env.GITHUB_REF,commit:process.env.GITHUB_SHA,migration});
    if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`preview_url=${result.previewUrl}\n`);
    if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`## Banco da prévia conectado\n\n- Banco: ${result.databaseName}\n- [Prévia validada](${result.previewUrl})\n- API: respondeu com ${result.listingCount} anúncio(s).\n- Configuração e deployment de produção preservados.\n- Nenhum anúncio fictício foi inserido.\n\nCadastro, sessões e envio para revisão devem passar pelo teste de integração da prévia. Nenhum administrador é criado automaticamente.\n`);
  }catch(error){
    console.error(error instanceof Error?error.message:'Não foi possível concluir a configuração da prévia.');process.exitCode=1;
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
