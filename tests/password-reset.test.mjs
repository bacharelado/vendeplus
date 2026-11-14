import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {database} from './helpers/database.mjs';
import {handleAccount,passwordHash,passwordMatches} from '../functions/_shared/account.ts';
import {SUPPORT_WHATSAPP_URL} from '../src/lib/support.mjs';

const origin='https://vendeplus.pages.dev';
const request=(path,method='GET',data,cookie='')=>new Request(origin+'/api/account/'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},...(data===undefined?{}:{body:JSON.stringify(data)})});
const legacyEnv={PASSWORD_RESET_ENABLED:'true',RESEND_API_KEY:'test-only',PASSWORD_RESET_FROM:'Teste <contato@example.invalid>'};
const digest=value=>createHash('sha256').update(value).digest('hex');

test('recuperação indica WhatsApp sem depender de banco ou de configuração antiga de e-mail',async()=>{
 const response=await handleAccount({request:request('password-reset/status'),env:legacyEnv});
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{available:false,method:'whatsapp',supportUrl:SUPPORT_WHATSAPP_URL});
 assert.equal(response.headers.get('cache-control'),'no-store');
});

test('pedidos e links antigos não consultam contas, criam tokens ou alteram senhas',async()=>{
 let touched=false;
 const db={prepare(){touched=true;throw Error('O banco não deve ser acessado')},batch(){touched=true;throw Error('O banco não deve ser acessado')}};
 for(const path of ['password-reset/request','password-reset/confirm']){
  for(const data of [{email:'owner@example.invalid'},{token:'a'.repeat(64),password:'Nova senha de teste'}]){
   const response=await handleAccount({request:request(path,'POST',data),env:{...legacyEnv,MARKETPLACE_DB:db}});
   assert.equal(response.status,410);
   assert.deepEqual(await response.json(),{error:'Para recuperar o acesso, fale com o suporte no WhatsApp.',supportUrl:SUPPORT_WHATSAPP_URL});
   assert.equal(response.headers.get('set-cookie'),null);
  }
 }
 assert.equal(touched,false);
});

test('alterar a própria senha continua exigindo a senha atual e encerra outras sessões',async()=>{
 const {db,sqlite}=database();
 try{
  sqlite.exec(readFileSync(new URL('../migrations/0004_password_resets.sql',import.meta.url),'utf8'));
  const encoded=await passwordHash('Senha antiga para teste');
  sqlite.prepare("INSERT INTO marketplace_sellers(id,display_name,whatsapp) VALUES ('owner','Teste','5592000000000')").run();
  sqlite.prepare("INSERT INTO marketplace_accounts(id,email,password_hash,neighborhood) VALUES ('owner','owner@example.invalid',?,'Poranga II')").run(encoded);
  const token='a'.repeat(64),other='b'.repeat(64);
  for(const value of [token,other])sqlite.prepare("INSERT INTO marketplace_sessions(token_hash,account_id,expires_at) VALUES (?,'owner',unixepoch()+1000)").run(digest(value));
  sqlite.prepare("INSERT INTO marketplace_password_resets(token_hash,account_id,email,expires_at) VALUES (?,'owner','owner@example.invalid',unixepoch()+900)").run(digest('c'.repeat(64)));
  const send=oldPassword=>handleAccount({request:request('password','POST',{oldPassword,newPassword:'Nova senha segura para teste'},'__Host-vendeplus='+token),env:{MARKETPLACE_DB:db}});
  assert.equal((await send('Senha errada para teste')).status,401);
  assert.equal((await send('Senha antiga para teste')).status,200);
  assert.equal(await passwordMatches('Nova senha segura para teste',sqlite.prepare("SELECT password_hash FROM marketplace_accounts WHERE id='owner'").get().password_hash),true);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM marketplace_sessions').get().n,1);
  assert.ok(sqlite.prepare('SELECT used_at FROM marketplace_password_resets').get().used_at);
 }finally{sqlite.close()}
});
