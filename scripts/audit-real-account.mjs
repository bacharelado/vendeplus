import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {accountId,projectName,databaseName,branchName,publicPreviewUrl} from './connect-preview-database.mjs';

if(process.env.GITHUB_REF!=='refs/heads/'+branchName||!process.env.CLOUDFLARE_API_TOKEN)throw Error('Auditoria exclusiva da branch de prévia.');
const origin=publicPreviewUrl(process.env.PREVIEW_URL);
const token=process.env.CLOUDFLARE_API_TOKEN;
const runId=randomBytes(12).toString('hex');
const emails=['qa-'+runId+'-a@example.invalid','qa-'+runId+'-b@example.invalid'];
const password='Qa!'+randomBytes(18).toString('base64url');
const folder='artifacts/audit-real-account';
const checkpoints=[];
const stamp=name=>{checkpoints.push(name);console.log('AUDITORIA OK: '+name)};
async function cloud(path,body){
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+accountId+'/'+path,{
  method:body?'POST':'GET',redirect:'error',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)
 });
 const result=await response.json();
 if(!response.ok||!result.success)throw Error('Cloudflare indisponível durante auditoria D1 (HTTP '+response.status+').');
 return result.result;
}
const project=await cloud('pages/projects/'+projectName);
const db=project.deployment_configs?.preview?.d1_databases?.MARKETPLACE_DB?.id;
if(!db||Object.values(project.deployment_configs?.production?.d1_databases||{}).some(value=>value.id===db)||project.production_branch===branchName)throw Error('Banco de prévia não isolado. Auditoria recusada.');
const known=await cloud('d1/database?name='+databaseName);
if(!known.some(value=>value.uuid===db&&value.name===databaseName))throw Error('Identificador inesperado do banco de prévia.');
const query=(sql,params=[])=>cloud('d1/database/'+db+'/query',{sql,params});
await mkdir(folder,{recursive:true});
let browser;
let auditError;
try{
 browser=await chromium.launch({headless:true});
 const contextA=await browser.newContext({viewport:{width:390,height:844},locale:'pt-BR'});
 const contextB=await browser.newContext({viewport:{width:1280,height:800},locale:'pt-BR'});
 const pageA=await contextA.newPage(),pageB=await contextB.newPage();
 const authApi=async(context,path,method='GET',data)=>{
  const response=await context.request.fetch(origin+'/api/account/'+path,{
   method,headers:{Origin:origin,'Content-Type':'application/json',Accept:'application/json'},
   ...(data===undefined?{}:{data})
  });
  return {status:response.status(),body:await response.json()};
 };
 const register=async(page,email,display)=>{
  await page.goto(origin+'/#cadastro',{waitUntil:'domcontentloaded'});
  await page.getByLabel('Seu nome').fill(display);
  await page.getByLabel('E-mail',{exact:true}).fill(email);
  await page.getByLabel('Senha',{exact:true}).fill(password);
  await page.locator('select[name="neighborhood"]').selectOption('Poranga II');
  await page.getByLabel('WhatsApp',{exact:true}).fill('+55 (92) 00000-0000');
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Criar conta',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Meus anúncios.'})).toBeVisible({timeout:25000});
 };
 await register(pageA,emails[0],'Auditoria privada A');
 await register(pageB,emails[1],'Auditoria privada B');
 const a=await authApi(contextA,'session'),b=await authApi(contextB,'session');
 assert.equal(a.status,200);assert.equal(a.body.account.email,emails[0]);assert.equal(a.body.account.role,'seller');
 assert.equal(b.body.account.email,emails[1]);assert.notEqual(b.body.account.id,a.body.account.id);
 stamp('Cadastro e autenticação de duas contas gravadas no D1');

 await pageA.reload({waitUntil:'domcontentloaded'});
 await expect(pageA.getByRole('heading',{name:'Meus anúncios.'})).toBeVisible();
 stamp('Persistência real da sessão após recarregar');

 await pageA.getByRole('textbox',{name:'Nome comercial'}).fill('Auditoria privada A atualizada');
 await pageA.getByRole('textbox',{name:'Sobre você ou seu negócio'}).fill('Perfil exclusivo da auditoria automatizada.');
 await pageA.getByRole('button',{name:'Salvar perfil'}).click();
 await expect(pageA.getByRole('status').filter({hasText:'Perfil atualizado.'})).toBeVisible();
 const profile=await authApi(contextA,'profile');
 assert.equal(profile.body.profile.name,'Auditoria privada A atualizada');
 stamp('Atualização do perfil e persistência no banco');

 const post=async(title,description)=>{
  await pageA.getByRole('button',{name:'Publicar novo anúncio'}).click();
  await pageA.getByRole('textbox',{name:'O que você está vendendo?',exact:true}).fill(title);
  await pageA.locator('select[name="category"]').selectOption('Casa');
  await pageA.getByRole('textbox',{name:'Preço em reais'}).fill('25,90');
  await pageA.getByRole('textbox',{name:'Conte sobre o produto',exact:true}).fill(description);
  await pageA.getByRole('textbox',{name:'Como será a entrega?'}).fill('Somente auditoria; não há oferta comercial.');
  await pageA.getByRole('button',{name:'Publicar anúncio',exact:true}).click();
  await expect(pageA.locator('.account-offer').filter({hasText:title})).toBeVisible({timeout:20000});
  const owned=await authApi(contextA,'listings');
  const item=owned.body.listings.find(entry=>entry.title===title);
  assert.ok(item,'Anúncio não foi gravado no D1');
  return item;
 };
 const restrictedTitle='Documentos falsos para revisão de auditoria';
 const restricted=await post(restrictedTitle,'Conteúdo temporário para verificar o bloqueio de ofertas suspeitas.');
 assert.equal(restricted.status,'pending');
 const firstCatalog=await (await contextB.request.get(origin+'/api/listings')).json();
 assert.ok(!firstCatalog.listings.some(item=>item.id===restricted.id));
 stamp('Anúncio sinalizado permanece fora da vitrine pública');

 const normalTitle='AUDITORIA INTERNA — NÃO COMPRAR '+randomBytes(3).toString('hex');
 const published=await post(normalTitle,'Registro temporário exclusivamente para testar publicação automática na prévia.');
 assert.equal(published.status,'published');
 const catalog=await (await contextB.request.get(origin+'/api/listings')).json();
 assert.ok(catalog.listings.some(item=>item.id===published.id),'Publicação não apareceu na API pública');
 stamp('Publicação automática na vitrine real da prévia');

 const forbidden=await authApi(contextB,'listings/'+published.id,'PATCH',{status:'removed'});
 assert.equal(forbidden.status,404);
 assert.equal((await authApi(contextB,'admin/stats')).status,403);
 const other=await authApi(contextB,'listings');
 assert.ok(!other.body.listings.some(item=>item.id===published.id));
 stamp('Isolamento de vendedores e proibição de acesso administrativo');

 await pageB.goto(origin+'/#anuncio-'+published.id,{waitUntil:'domcontentloaded'});
 await expect(pageB.getByRole('heading',{name:normalTitle})).toBeVisible({timeout:15000});
 await expect(pageB.getByRole('link',{name:/Conversar no WhatsApp/})).toHaveAttribute('href',/^https:\/\/wa\.me\/5592000000000\?text=/);
 stamp('Visibilidade no navegador do comprador e link WhatsApp');

 await pageB.getByRole('button',{name:'Denunciar este anúncio'}).click();
 await pageB.locator('.report-form select').selectOption('fraud');
 await pageB.getByRole('button',{name:'Enviar denúncia'}).click();
 await expect(pageB.getByRole('status').filter({hasText:'Denúncia recebida'})).toBeVisible();
 const reports=await query('SELECT COUNT(*) AS total FROM marketplace_reports WHERE listing_id=?',[published.id]);
 assert.equal(Number(reports[0].results[0].total),1);
 stamp('Denúncia de usuário gravada no D1');

 await pageA.locator('.account-offer').filter({hasText:normalTitle}).getByRole('button',{name:'Editar'}).click();
 const editedTitle=normalTitle+' EDITADO';
 await pageA.getByRole('textbox',{name:'O que você está vendendo?',exact:true}).fill(editedTitle);
 await pageA.getByRole('button',{name:'Salvar alterações',exact:true}).click();
 await expect(pageA.locator('.account-offer').filter({hasText:editedTitle})).toBeVisible();
 const edited=await authApi(contextA,'listings');
 assert.equal(edited.body.listings.find(item=>item.id===published.id).title,editedTitle);
 stamp('Edição do anúncio restrita ao proprietário');

 await pageA.locator('.account-offer').filter({hasText:editedTitle}).getByRole('button',{name:'Pausar'}).click();
 await expect(pageA.locator('.account-offer').filter({hasText:editedTitle})).toContainText('Pausado');
 const hidden=await (await contextB.request.get(origin+'/api/listings')).json();
 assert.ok(!hidden.listings.some(item=>item.id===published.id));
 stamp('Pausa retira anúncio imediatamente da vitrine');

 await pageA.screenshot({path:folder+'/vendedor-mobile.png',fullPage:true});
 await pageB.goto(origin+'/#catalogo',{waitUntil:'domcontentloaded'});
 await pageB.screenshot({path:folder+'/catalogo-desktop.png',fullPage:true});
 stamp('Evidências visuais salvas');
 await pageA.getByRole('button',{name:'Sair',exact:true}).click();
 await expect(pageA.getByRole('heading',{name:'Entre na sua conta.'})).toBeVisible();
 assert.equal((await authApi(contextA,'session')).body.account,null);
 stamp('Logout revoga sessão autenticada');
}catch(error){
 auditError=error;
 console.error('AUDITORIA FALHOU: '+(error instanceof Error?error.message:'erro desconhecido'));
}finally{
 if(browser)await browser.close();
 try{
  for(const email of emails){
   const rows=await query('SELECT id FROM marketplace_accounts WHERE email=?',[email]);
   for(const {id} of rows[0]?.results||[]){
    const steps=[
     ['UPDATE marketplace_listings SET status=? WHERE seller_id=? AND status=?',['removed',id,'published']],
     ['DELETE FROM marketplace_reports WHERE listing_id IN (SELECT id FROM marketplace_listings WHERE seller_id=?)',[id]],
     ['DELETE FROM marketplace_listing_events WHERE seller_id=?',[id]],
     ['DELETE FROM marketplace_listing_details WHERE seller_id=?',[id]],
     ['DELETE FROM marketplace_listings WHERE seller_id=?',[id]],
     ['DELETE FROM marketplace_sessions WHERE account_id=?',[id]],
     ['DELETE FROM marketplace_seller_profiles WHERE seller_id=?',[id]],
     ['DELETE FROM marketplace_accounts WHERE id=? AND email=?',[id,email]],
     ['DELETE FROM marketplace_sellers WHERE id=?',[id]]
    ];
    for(const [sql,params] of steps)await query(sql,params);
   }
  }
  stamp('Contas e registros temporários excluídos sem modificar usuários reais');
 }catch(e){
  auditError ||=e;
  console.error('FALHA DE LIMPEZA: '+(e instanceof Error?e.message:'erro desconhecido'));
 }
 const md='# VENDE+ 2.0 — Auditoria real por navegador\n\n'
  +'Ambiente: Cloudflare Pages prévia com D1 (sem mocks)\n'
  +'Executado em: '+new Date().toISOString()+'\n'
  +'Situação: '+(auditError?'FALHOU':'APROVADA')+'\n\n'
  +checkpoints.map((x,i)=>(i+1)+'. '+x).join('\n')+'\n';
 await writeFile(folder+'/relatorio.md',md);
}
if(auditError)throw auditError;
console.log('AUDITORIA FINAL: '+checkpoints.length+' verificações e limpeza confirmadas.');
