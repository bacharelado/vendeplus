import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {database} from './helpers/database.mjs';
import {handlePasswordReset} from '../functions/_shared/password-reset.ts';
import {passwordHash,passwordMatches,handleAccount} from '../functions/_shared/account.ts';
const migration=readFileSync(new URL('../migrations/0004_password_resets.sql',import.meta.url),'utf8');
const env={PASSWORD_RESET_ENABLED:'true',RESEND_API_KEY:'test-only-key',PASSWORD_RESET_FROM:'VENDE+ <contato@example.invalid>'};
const digest=value=>createHash('sha256').update(value).digest('hex');
async function harness(){
 const h=database();h.sqlite.exec(migration);h.sqlite.exec(migration);
 const oldHash=await passwordHash('Senha antiga para teste');
 h.sqlite.prepare("INSERT INTO marketplace_sellers(id,display_name,whatsapp) VALUES ('owner','Teste','5592000000000')").run();
 h.sqlite.prepare("INSERT INTO marketplace_accounts(id,email,password_hash,neighborhood) VALUES ('owner','owner@example.invalid',?,'Poranga II')").run(oldHash);
 h.sqlite.prepare("INSERT INTO marketplace_sessions(token_hash,account_id,expires_at) VALUES ('session','owner',unixepoch()+1000)").run();
 const mail=[],tasks=[];
 const original=h.db.batch;let queue=Promise.resolve();
 h.db.batch=statements=>{const result=queue.then(()=>original(statements));queue=result.catch(()=>{});return result};
 const request=async(path,data={},options={})=>{
  const r=await handlePasswordReset({db:h.db,env,request:new Request('https://vendeplus.pages.dev/api/account/password-reset/'+path,{method:path==='status'?'GET':'POST'}),path:'/password-reset/'+path,data,hashPassword:passwordHash,rate:async()=>{},waitUntil:task=>tasks.push(task),sendEmail:async(_env,email,url)=>{mail.push({email,url})},...options});
  await Promise.all(tasks.splice(0));return {status:r.status,body:await r.json(),headers:r.headers};
 };
 return {...h,oldHash,mail,request,token:()=>h.mail?.[0]};
}
test('desativado não emite link nem cria tokens',async()=>{
 const h=await harness();
 assert.equal((await h.request('status',{}, {env:{}})).body.available,false);
 assert.equal((await h.request('request',{email:'owner@example.invalid'},{env:{}})).status,503);
 assert.equal(h.mail.length,0);assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM marketplace_password_resets').get().n,0);
});
test('destinatários conhecidos e desconhecidos recebem a mesma resposta; token só vai ao e-mail',async()=>{
 const h=await harness(),yes=await h.request('request',{email:'owner@example.invalid'}),no=await h.request('request',{email:'missing@example.invalid'});
 assert.deepEqual(yes.body,no.body);assert.equal(yes.status,200);assert.equal(h.mail.length,1);
 const token=new URL(h.mail[0].url).hash.split('redefinir=')[1];assert.match(token,/^[a-f0-9]{64}$/);
 const row=h.sqlite.prepare('SELECT * FROM marketplace_password_resets').get();assert.equal(row.token_hash,digest(token));assert.notEqual(row.token_hash,token);
 assert(!JSON.stringify(yes.body).includes(token));assert.equal(h.mail[0].email,'owner@example.invalid');
 assert(row.expires_at-row.created_at<=900);
});
test('link válido troca senha, encerra sessões e não pode ser reutilizado',async()=>{
 const h=await harness();await h.request('request',{email:'owner@example.invalid'});
 const token=new URL(h.mail[0].url).hash.split('redefinir=')[1];
 const r=await h.request('confirm',{token,password:'Nova senha segura para teste'});assert.equal(r.status,200);
 const row=h.sqlite.prepare("SELECT password_hash FROM marketplace_accounts WHERE id='owner'").get();
 assert(await passwordMatches('Nova senha segura para teste',row.password_hash));assert.equal(await passwordMatches('Senha antiga para teste',row.password_hash),false);
 assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM marketplace_sessions').get().n,0);
 assert.match(r.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal((await h.request('confirm',{token,password:'Outra senha segura para teste'})).status,400);
});
test('tokens expirados, alterados e de contas suspensas não mudam a senha',async()=>{
 for(const variant of ['expired','tampered','suspended']){
  const h=await harness();await h.request('request',{email:'owner@example.invalid'});
  let token=new URL(h.mail[0].url).hash.split('redefinir=')[1];
  if(variant==='expired')h.sqlite.exec('UPDATE marketplace_password_resets SET expires_at=0');
  if(variant==='tampered')token=(token[0]==='0'?'1':'0')+token.slice(1);
  if(variant==='suspended')h.sqlite.exec("UPDATE marketplace_sellers SET status='suspended'");
  assert.equal((await h.request('confirm',{token,password:'Nova senha segura para teste'})).status,400);
  assert.equal(h.sqlite.prepare("SELECT password_hash FROM marketplace_accounts WHERE id='owner'").get().password_hash,h.oldHash);
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM marketplace_sessions').get().n,1);
 }
});
test('dois usos concorrentes do mesmo link permitem somente uma alteração',async()=>{
 const h=await harness();await h.request('request',{email:'owner@example.invalid'});
 const token=new URL(h.mail[0].url).hash.split('redefinir=')[1];
 const results=await Promise.all([h.request('confirm',{token,password:'Senha concorrente número um'}),h.request('confirm',{token,password:'Senha concorrente número dois'})]);
 assert.deepEqual(results.map(x=>x.status).sort(),[200,400]);
});
test('troca manual de senha invalida os links de recuperação anteriores',async()=>{
 const h=await harness();await h.request('request',{email:'owner@example.invalid'});
 const token=new URL(h.mail[0].url).hash.split('redefinir=')[1];
 const session='a'.repeat(64);h.sqlite.prepare('INSERT INTO marketplace_sessions(token_hash,account_id,expires_at) VALUES (?,\'owner\',unixepoch()+1000)').run(digest(session));
 const response=await handleAccount({request:new Request('https://vendeplus.pages.dev/api/account/password',{method:'POST',headers:{Origin:'https://vendeplus.pages.dev','Content-Type':'application/json',Cookie:'__Host-vendeplus='+session},body:JSON.stringify({oldPassword:'Senha antiga para teste',newPassword:'Senha alterada manualmente'})}),env:{MARKETPLACE_DB:h.db}});
 assert.equal(response.status,200);
 assert.equal((await h.request('confirm',{token,password:'Senha posterior por link antigo'})).status,400);
});
test('endpoint real recusa origem cruzada e limita tentativas sem enviar e-mails',async()=>{
 const h=await harness();
 const send=async(origin='https://vendeplus.pages.dev')=>handleAccount({request:new Request('https://vendeplus.pages.dev/api/account/password-reset/confirm',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.42'},body:JSON.stringify({token:'invalid',password:'Senha válida para teste'})}),env:{MARKETPLACE_DB:h.db}});
 assert.equal((await send('https://other.invalid')).status,403);
 for(let n=0;n<10;n++)assert.equal((await send()).status,400);
 assert.equal((await send()).status,429);
 assert.equal(h.mail.length,0);
});
