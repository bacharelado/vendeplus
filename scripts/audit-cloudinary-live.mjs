import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {PNG} from 'pngjs';
import {chromium,expect} from '@playwright/test';
import {accountId,projectName,publicPreviewUrl} from './connect-preview-database.mjs';
const token=process.env.CLOUDFLARE_API_TOKEN,commit=process.env.GITHUB_SHA;
if(!token||process.env.GITHUB_REF!=='refs/heads/feat/cloudinary-fotos-free'||!/^[a-f0-9]{40}$/.test(commit||''))throw Error('Auditoria exclusiva do commit da prévia.');
const folder='artifacts/cloudinary-live',report={commit,started:new Date().toISOString(),checks:[],cleanup:false};
await mkdir(folder,{recursive:true});
const stamp=value=>{report.checks.push(value);console.log('QA_OK '+value)};
async function cloud(path,body){
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+accountId+path,{method:body?'POST':'GET',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
 const value=await response.json();
 if(!response.ok||!value.success)throw Error('Cloudflare HTTP '+response.status+' — operação não confirmada.');
 return value.result;
}
const project=await cloud('/pages/projects/'+projectName);
const db=project.deployment_configs?.preview?.d1_databases?.MARKETPLACE_DB?.id;
assert.ok(db&&!Object.values(project.deployment_configs?.production?.d1_databases||{}).some(b=>b.id===db),'Prévia precisa de D1 isolado.');
const query=(sql,params=[])=>cloud('/d1/database/'+db+'/query',{sql,params});
let deployment;
for(let i=0;i<60;i++){
 const deployments=await cloud('/pages/projects/'+projectName+'/deployments?per_page=20');
 deployment=deployments.find(d=>d.environment==='preview'&&d.deployment_trigger?.metadata?.commit_hash===commit&&d.deployment_trigger?.metadata?.branch==='feat/cloudinary-fotos-free');
 if(deployment?.latest_stage?.name==='deploy'&&deployment.latest_stage.status==='success')break;
 if(deployment&&['failure','canceled','cancelled'].includes(deployment.latest_stage?.status))throw Error('Deploy da prévia falhou.');
 await new Promise(resolve=>setTimeout(resolve,5000));
}
assert.equal(deployment?.latest_stage?.name,'deploy');assert.equal(deployment?.latest_stage?.status,'success');
const origin=publicPreviewUrl(deployment.url);report.preview=origin;
const idTag=randomBytes(10).toString('hex'),emails=[0,1].map(i=>'qa-cloudinary-'+idTag+'-'+i+'@example.invalid');
const password='Qa!'+randomBytes(24).toString('base64url');
const sessions=[],accounts=[],listings=[];
let browser,failure;
async function request(path,{method='GET',body,cookie='',png=false}={}){
 const response=await fetch(origin+path,{method,redirect:'error',headers:{Origin:origin,Accept:'application/json',...(method==='GET'?{}:{'Content-Type':png?'image/png':'application/json'}),...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:png?body:JSON.stringify(body)}),signal:AbortSignal.timeout(45000)});
 const value=await response.json();
 return {status:response.status,body:value,cookie:response.headers.get('Set-Cookie')?.split(';')[0],headers:response.headers};
}
try{
 for(let i=0;i<2;i++){
  const r=await request('/api/account/register',{method:'POST',body:{name:'TESTE APOCALYPTIC QA '+i,email:emails[i],password,whatsapp:'5592000000000',neighborhood:'Poranga II',acceptContact:true}});
  assert.equal(r.status,201);assert.ok(r.cookie);assert.equal(r.body.account.role,'seller');
  assert.match(r.headers.get('Set-Cookie'),/HttpOnly/);assert.match(r.headers.get('Set-Cookie'),/Secure/);
  accounts.push(r.body.account.id);sessions.push(r.cookie);
 }
 stamp('Cadastro real de duas contas QA e cookies protegidos');
 assert.equal((await request('/api/account/logout',{method:'POST',body:{},cookie:sessions[0]})).status,200);
 const login=await request('/api/account/login',{method:'POST',body:{email:emails[0],password}});
 assert.equal(login.status,200);sessions[0]=login.cookie;
 assert.equal((await request('/api/account/session',{cookie:sessions[0]})).body.account.id,accounts[0]);
 stamp('Login real e persistência da sessão');
 const title='TESTE APOCALYPTIC CLOUDINARY '+idTag;
 const offer={title,description:'ANÚNCIO FICTÍCIO DE AUDITORIA. Não comprar. Sem valor comercial. Será removido ao fim do teste.',priceCents:100,category:'Eletrônicos',condition:'Novo',neighborhood:'Poranga II',fulfillment:'TESTE — sem entrega',requestId:randomUUID()};
 const created=await request('/api/account/listings',{method:'POST',body:offer,cookie:sessions[0]});
 assert.equal(created.status,201);assert.equal(created.body.status,'published');const id=created.body.id;listings.push(id);
 stamp('Publicação automática real de anúncio QA');
 const pixels=Buffer.alloc(320*240*4);
 for(let y=0;y<240;y++)for(let x=0;x<320;x++){const n=(y*320+x)*4;pixels[n]=x%256;pixels[n+1]=y%256;pixels[n+2]=160;pixels[n+3]=255;}
 const png=PNG.sync.write({width:320,height:240,data:pixels});
 const uploaded=await request('/api/media-upload?listingId='+id,{method:'POST',png:true,body:png,cookie:sessions[0]});
 report.upload={http:uploaded.status,...(uploaded.status===200?{ok:uploaded.body.ok}:{error:uploaded.body.error,code:uploaded.body.code,requestId:uploaded.body.requestId})};
 console.log('UPLOAD_RESULT '+JSON.stringify(report.upload));
 assert.equal(uploaded.status,200,'Upload real de PNG precisa retornar HTTP 200');
 const image=uploaded.body.image;assert.equal(new URL(image).origin,origin);assert.match(new URL(image).pathname,/^\/api\/media\/c-/);
 stamp('Upload de PNG no Cloudinary autenticado HTTP 200');
 const photo=await fetch(image,{redirect:'error'});assert.equal(photo.status,200);assert.match(photo.headers.get('Content-Type'),/^image\/png/);
 const decoded=PNG.sync.read(Buffer.from(await photo.arrayBuffer()));assert.equal(decoded.width,320);assert.equal(decoded.height,240);assert.deepEqual(decoded.data,pixels);
 stamp('Entrega pública HTTP 200 e pixels idênticos ao PNG enviado');
 assert.equal((await request('/api/media-upload?listingId='+id,{method:'POST',png:true,body:png,cookie:sessions[1]})).status,404);
 assert.equal((await request('/api/account/listings/'+id,{method:'PATCH',body:{status:'removed'},cookie:sessions[1]})).status,404);
 assert.equal((await request('/api/account/admin/stats',{cookie:sessions[0]})).status,403);
 stamp('Outro vendedor não altera nem envia foto ao anúncio; admin protegido');
 const edited=await request('/api/account/listings/'+id,{method:'PATCH',body:{...offer,action:'edit',title:title+' EDITADO',priceCents:200},cookie:sessions[0]});
 assert.equal(edited.status,200);
 const catalog=await request('/api/listings?id='+id);assert.equal(catalog.body.listings[0].title,title+' EDITADO');assert.equal(catalog.body.listings[0].image,image);
 stamp('Edição persistida e imagem preservada no catálogo público');
 browser=await chromium.launch({headless:true});
 for(const [name,viewport] of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport});const page=await context.newPage();
  await page.goto(origin+'/#anuncio-'+id);
  await expect(page.getByRole('heading',{name:title+' EDITADO',exact:true})).toBeVisible();
  const rendered=page.locator('img[src="'+image+'"]');
  await expect(rendered).toBeVisible();
  await expect.poll(()=>rendered.evaluate(im=>im.complete&&im.naturalWidth===320&&im.naturalHeight===240),{timeout:15000}).toBe(true);
  await page.screenshot({path:folder+'/'+name+'.png',fullPage:true});
  await context.close();
 }
 stamp('Fotografia visível no navegador desktop e mobile');
 for(const status of ['paused','published']){
  assert.equal((await request('/api/account/listings/'+id,{method:'PATCH',body:{status},cookie:sessions[0]})).status,200);
  const visible=await fetch(image,{redirect:'error'});assert.equal(visible.status,status==='paused'?404:200);await visible.body?.cancel();
 }
 stamp('Foto bloqueada em anúncio pausado e liberada após reativação');
 const removed=await request('/api/account/listings/'+id,{method:'PATCH',body:{status:'removed'},cookie:sessions[0]});
 assert.equal(removed.status,200);assert.ok(!removed.body.warning,'Exclusão da fotografia precisa ser confirmada');
 const gone=await fetch(image,{redirect:'error'});assert.equal(gone.status,404);await gone.body?.cancel();
 assert.equal((await request('/api/listings?id='+id)).body.listings.length,0);
 stamp('Exclusão do anúncio e limpeza da fotografia confirmadas');
}catch(error){failure=error;report.failure=error.message;console.error('QA_FAILURE '+error.message)}
finally{
 if(browser)await browser.close();
 try{
  for(let i=0;i<listings.length;i++){
   const found=await query('SELECT status FROM marketplace_listings WHERE id=? AND seller_id=?',[listings[i],accounts[0]]);
   if(found?.[0]?.results?.[0]?.status!=='removed'){
    const removed=await request('/api/account/listings/'+listings[i],{method:'PATCH',body:{status:'removed'},cookie:sessions[0]});
    assert.equal(removed.status,200);assert.ok(!removed.body.warning,'Foto QA pendente de limpeza; preservar registro para revisão.');
   }
  }
  for(let i=0;i<emails.length;i++){
   const found=await query('SELECT id FROM marketplace_accounts WHERE email=?',[emails[i]]);
   for(const {id} of found?.[0]?.results||[]){
    // Exact generated email + account ID; never delete real accounts.
    for(const [sql,params] of [
     ['DELETE FROM marketplace_reports WHERE listing_id IN (SELECT id FROM marketplace_listings WHERE seller_id=?)',[id]],
     ['DELETE FROM marketplace_listing_events WHERE seller_id=?',[id]],
     ['DELETE FROM marketplace_listing_details WHERE seller_id=?',[id]],
     ['DELETE FROM marketplace_listings WHERE seller_id=?',[id]],
     ['DELETE FROM marketplace_sessions WHERE account_id=?',[id]],
     ['DELETE FROM marketplace_seller_profiles WHERE seller_id=?',[id]],
     ['DELETE FROM marketplace_accounts WHERE id=? AND email=?',[id,emails[i]]],
     ['DELETE FROM marketplace_sellers WHERE id=?',[id]],
     ['DELETE FROM marketplace_rate_limits WHERE key=?',[createHash('sha256').update('listing:'+id).digest('hex')]],
     ['DELETE FROM marketplace_rate_limits WHERE key=?',[createHash('sha256').update('upload:'+id).digest('hex')]],
     ['DELETE FROM marketplace_rate_limits WHERE key=?',[createHash('sha256').update('cloudinary:seller:'+id).digest('hex')]]
    ])await query(sql,params);
   }
   await query('DELETE FROM marketplace_rate_limits WHERE key=?',[createHash('sha256').update('auth-email:'+emails[i]).digest('hex')]);
   assert.equal((await query('SELECT id FROM marketplace_accounts WHERE email=?',[emails[i]]))[0].results.length,0);
  }
  report.cleanup=true;stamp('Dados temporários QA removidos do D1; usuários reais preservados');
 }catch(error){failure||=error;report.cleanupError=error.message;console.error('QA_CLEANUP_FAILURE '+error.message)}
 report.finished=new Date().toISOString();report.passed=!failure;
 await writeFile(folder+'/report.json',JSON.stringify(report,null,2));
 console.log('QA_SUMMARY '+JSON.stringify(report));
}
if(failure)process.exitCode=1;
