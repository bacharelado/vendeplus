import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {accountId,projectName,databaseName,branchName,publicPreviewUrl} from './connect-preview-database.mjs';
const origin=publicPreviewUrl(process.env.PREVIEW_URL);
if(process.env.GITHUB_REF!==`refs/heads/${branchName}`||!process.env.CLOUDFLARE_API_TOKEN)throw Error('Teste permitido apenas na branch de desenvolvimento, com token.');
const token=process.env.CLOUDFLARE_API_TOKEN;
async function cf(path,body){const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/${path}`,{method:body?'POST':'GET',redirect:'error',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});const result=await response.json();if(!response.ok||!result.success)throw Error('Não foi possível validar ou limpar os dados de teste na API Cloudflare.');return result.result}
const project=await cf(`pages/projects/${projectName}`),db=project.deployment_configs?.preview?.d1_databases?.MARKETPLACE_DB?.id;
if(!db||Object.values(project.deployment_configs?.production?.d1_databases||{}).some(value=>value.id===db)||project.production_branch===branchName)throw Error('Banco de prévia não isolado. Teste bloqueado.');
const databases=await cf(`d1/database?name=${databaseName}`);if(!databases.some(value=>value.uuid===db&&value.name===databaseName))throw Error('Banco inesperado.');
const query=async(sql,params=[])=>cf(`d1/database/${db}/query`,{sql,params});
const prefix=`preview-${randomBytes(12).toString('hex')}`,emails=[`${prefix}-a@example.invalid`,`${prefix}-b@example.invalid`],password=randomBytes(6).toString('base64url');
const create=email=>({email,password,name:'Verificação automatizada privada',neighborhood:'Poranga II',whatsapp:'+55 (92) 00000-0000',acceptContact:true});
async function api(path,method='GET',body,cookie=''){
 const response=await fetch(origin+'/api/account/'+path,{method,redirect:'error',headers:{Origin:origin,Accept:'application/json','Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 let data;try{data=await response.json()}catch{throw Error(`A prévia não respondeu JSON em ${path}: HTTP ${response.status}.`)}
 return {status:response.status,data,cookie:response.headers.get('Set-Cookie')?.split(';')[0]||''};
}
try{
 assert.equal((await api('session')).data.account,null);
 const a=await api('register','POST',create(emails[0]));assert.equal(a.status,201,'Cadastro A falhou.');assert(a.cookie);assert.equal(a.data.account.role,'seller');assert.equal(a.data.account.status,'pending');
 const b=await api('register','POST',create(emails[1]));assert.equal(b.status,201,'Cadastro B falhou.');
 const input={requestId:randomUUID(),title:'Documentos falsos para revisão privada',description:'Dado temporário para conferir permissões e revisão.',priceCents:100,category:'Casa',condition:'Novo',fulfillment:'Sem oferta comercial: teste privado a remover.',neighborhood:'Poranga II'};
 const sent=await api('listings','POST',input,a.cookie);assert.equal(sent.status,201,'Envio ao D1 falhou.');assert.equal(sent.data.status,'pending');
 assert.equal((await api('listings','POST',input,a.cookie)).data.id,sent.data.id);
 assert.equal((await api('listings','GET',undefined,a.cookie)).data.listings.length,1);assert.equal((await api('listings','GET',undefined,b.cookie)).data.listings.length,0);
 assert.equal((await api('listings/'+sent.data.id,'PATCH',{status:'removed'},b.cookie)).status,404);
 assert.equal((await api('moderation','GET',undefined,a.cookie)).status,403);
 const catalog=await fetch(origin+'/api/listings',{signal:AbortSignal.timeout(20000)}).then(r=>r.json());assert(!catalog.listings.some(item=>item.id===sent.data.id),'Anúncio pendente vazou para o catálogo.');
 assert.equal((await api('logout','POST',{},a.cookie)).status,200);assert.equal((await api('session','GET',undefined,a.cookie)).data.account,null);
 const login=await api('login','POST',{email:emails[0],password});assert.equal(login.status,200,'Login real falhou.');assert.equal((await api('listings','GET',undefined,login.cookie)).data.listings.length,1);
 console.log('Prévia: cadastro, login, sessão, envio D1, idempotência, isolamento, revisão e logout aprovados.');
}finally{
 for(const email of emails){
  const rows=await query('SELECT id FROM marketplace_accounts WHERE email=?',[email]);
  for(const {id} of rows[0]?.results||[]){
   const published=await query("SELECT count(*) AS total FROM marketplace_listings WHERE seller_id=? AND status='published'",[id]);if(published[0]?.results?.[0]?.total)throw Error('Limpeza bloqueada: a conta temporária possui conteúdo publicado.');
   await query('DELETE FROM marketplace_listing_events WHERE seller_id=?',[id]);await query('DELETE FROM marketplace_listing_details WHERE seller_id=?',[id]);await query('DELETE FROM marketplace_listings WHERE seller_id=?',[id]);await query('DELETE FROM marketplace_sessions WHERE account_id=?',[id]);await query('DELETE FROM marketplace_accounts WHERE id=? AND email=?',[id,email]);await query('DELETE FROM marketplace_sellers WHERE id=?',[id]);
  }
 }
 console.log('Contas e anúncios temporários removidos do banco exclusivo da prévia.');
}
