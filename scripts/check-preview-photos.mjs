import {accountId,projectName,branchName} from './connect-preview-database.mjs';

if(process.env.GITHUB_REF!=='refs/heads/'+branchName)throw Error('Verificação permitida somente na prévia.');
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token||/[\r\n]/.test(token))throw Error('O acesso Cloudflare não está configurado.');
async function read(path){
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+accountId+'/'+path,{redirect:'error',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
 const value=await response.json();
 return {status:response.status,ok:response.ok&&value.success===true,value};
}
const project=await read('pages/projects/'+projectName);
if(!project.ok||project.value.result?.production_branch===branchName)throw Error('Não foi possível confirmar os ambientes separados.');
const buckets=await read('r2/buckets?name=vendeplus-images-preview');
if(!buckets.ok){
 const codes=(buckets.value.errors||[]).map(e=>e.code).join(',');
 const messages=(buckets.value.errors||[]).map(e=>String(e.message||'').replaceAll(token,'[redigido]').slice(0,180)).join('; ');
 console.log('FOTOS_BLOQUEADAS: HTTP '+buckets.status+'; códigos '+codes+'; '+messages);
 console.log('Nenhuma configuração foi alterada.');
 process.exitCode=1;
}else{
 console.log('R2_LEITURA_OK: o acesso atual consegue consultar armazenamento de fotos.');
 console.log('BUCKET_PREVIA_EXISTENTE: '+!!buckets.value.result?.buckets?.some(b=>b.name==='vendeplus-images-preview'));
 console.log('BINDING_PREVIA_EXISTENTE: '+!!project.value.result.deployment_configs?.preview?.r2_buckets?.LISTING_IMAGES);
}
