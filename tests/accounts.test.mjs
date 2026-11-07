import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {handleAccount,passwordHash,passwordMatches} from '../functions/_shared/account.ts';
import {catalogQuery} from '../functions/_shared/catalog-query.ts';
const migrations=(await Promise.all(['0001_marketplace','0002_accounts'].map(name=>readFile(new URL('../migrations/'+name+'.sql',import.meta.url),'utf8')))).join('\n');
function harness(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(migrations);sqlite.exec(migrations);
 const db={prepare(sql){let values=[];const stmt={bind(...args){values=args;return stmt},async first(){return sqlite.prepare(sql).get(...values)||null},async all(){return {results:sqlite.prepare(sql).all(...values)}},async run(){return {meta:sqlite.prepare(sql).run(...values)}}};return stmt},async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const stmt of statements)result.push(await stmt.run());sqlite.exec('COMMIT');return result}catch(error){sqlite.exec('ROLLBACK');throw error}}};
 const request=async(path,method='GET',data,cookie='',extra={})=>{const response=await handleAccount({request:new Request('https://preview.vendeplus.pages.dev/api/account/'+path,{method,headers:{Origin:'https://preview.vendeplus.pages.dev','Content-Type':'application/json',Cookie:cookie,...extra},body:data===undefined?undefined:JSON.stringify(data)}),env:{MARKETPLACE_DB:db}});return {status:response.status,body:await response.json(),cookie:response.headers.get('Set-Cookie'),headers:response.headers}};
 return {sqlite,request};
}
const registration=(email='owner@example.invalid')=>({name:'Conta de teste',email,password:'Senha longa para teste 2026!',whatsapp:'5592000000000',neighborhood:'Poranga II',acceptContact:true,role:'admin',status:'approved'});
const offer=(requestId=crypto.randomUUID())=>({requestId,title:'Item privado de teste',description:'Item para testar a revisão e as permissões.',priceCents:5000,category:'Casa',condition:'Usado',fulfillment:'Retirada combinada',neighborhood:'Poranga II',status:'published',seller_id:'other'});

test('senha usa salt individual e scrypt; senha errada é recusada',async()=>{const a=await passwordHash('Senha de teste longa');const b=await passwordHash('Senha de teste longa');assert.notEqual(a,b);assert(await passwordMatches('Senha de teste longa',a));assert.equal(await passwordMatches('outra senha de teste',a),false)});
test('cadastro real persiste, não permite escalar privilégios e cookie é protegido',async()=>{
 const h=harness(),res=await h.request('register','POST',registration());assert.equal(res.status,201);assert.equal(res.body.account.role,'seller');assert.equal(res.body.account.status,'pending');assert.match(res.cookie,/HttpOnly; Secure; SameSite=Lax/);assert.match(res.cookie,/^__Host-/);assert.equal(res.headers.get('Cache-Control'),'no-store');
 const row=h.sqlite.prepare('SELECT * FROM marketplace_accounts').get();assert.notEqual(row.password_hash,registration().password);assert(!JSON.stringify(res.body).includes('password_hash'));const session=h.sqlite.prepare('SELECT * FROM marketplace_sessions').get();assert(!res.cookie.includes(session.token_hash));
 assert.equal((await h.request('session','GET',undefined,res.cookie)).body.account.email,registration().email);assert.equal((await h.request('session')).body.account,null);
 assert.equal((await h.request('register','POST',registration())).status,409);assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM marketplace_sellers').get().n,1);
});
test('login, expiração, logout e suspensão revogam o acesso',async()=>{
 const h=harness(),registered=await h.request('register','POST',registration());assert.equal((await h.request('login','POST',{email:registration().email,password:'Senha errada suficientemente longa'})).status,401);
 const login=await h.request('login','POST',registration());assert.equal(login.status,200);assert.notEqual(login.cookie,registered.cookie);assert.equal((await h.request('logout','POST',{},login.cookie)).status,200);assert.equal((await h.request('listings','GET',undefined,login.cookie)).status,401);
 h.sqlite.exec('UPDATE marketplace_sessions SET expires_at=0');assert.equal((await h.request('listings','GET',undefined,registered.cookie)).status,401);
 const again=await h.request('login','POST',registration());h.sqlite.exec("UPDATE marketplace_sellers SET status='suspended'");assert.equal((await h.request('session','GET',undefined,again.cookie)).body.account,null);assert.equal((await h.request('login','POST',registration())).status,401);
});
test('CSRF, formato e corpo excessivo são bloqueados antes de gravar',async()=>{
 const h=harness();for(const [headers,status] of [[{Origin:'https://evil.test'},403],[{Origin:''},403],[{'Content-Type':'text/plain'},415],[{'Content-Length':'20000'},413]])assert.equal((await h.request('register','POST',registration(),'',headers)).status,status);
 assert.equal((await h.request('register','POST',{...registration(),name:'x'.repeat(20000)})).status,413);assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM marketplace_accounts').get().n,0);
});
test('envio exige sessão, salva pendente, é idempotente e isola vendedores',async()=>{
 const h=harness();assert.equal((await h.request('listings','POST',offer())).status,401);
 const owner=await h.request('register','POST',registration()),other=await h.request('register','POST',registration('other@example.invalid')),data=offer();
 const created=await h.request('listings','POST',data,owner.cookie);assert.equal(created.status,201);assert.equal(created.body.status,'pending');const repeated=await h.request('listings','POST',data,owner.cookie);assert.equal(repeated.body.id,created.body.id);
 assert.equal((await h.request('listings','GET',undefined,owner.cookie)).body.listings.length,1);assert.equal((await h.request('listings','GET',undefined,other.cookie)).body.listings.length,0);assert.equal(h.sqlite.prepare(catalogQuery).all().length,0);
 assert.equal((await h.request('listings/'+created.body.id,'PATCH',{status:'removed'},other.cookie)).status,404);assert.equal((await h.request('listings/'+created.body.id,'PATCH',{status:'published'},owner.cookie)).status,400);
 assert.equal((await h.request('moderation')).status,401);assert.equal((await h.request('moderation','GET',undefined,owner.cookie)).status,403);assert.equal((await h.request('moderation/'+created.body.id,'POST',{status:'published'},owner.cookie)).status,403);
});
test('somente admin revisa vendedor e anúncio, deixando trilha no banco',async()=>{
 const h=harness(),owner=await h.request('register','POST',registration()),admin=await h.request('register','POST',registration('admin@example.invalid'));
 h.sqlite.prepare("UPDATE marketplace_accounts SET role='admin' WHERE id=?").run(admin.body.account.id);
 const created=await h.request('listings','POST',offer(),owner.cookie),id=created.body.id;
 assert.equal((await h.request(`moderation/${id}`,'POST',{status:'published'},admin.cookie)).status,409);
 assert.equal((await h.request(`moderation/${id}/seller`,'POST',{},admin.cookie)).status,400);
 assert.equal((await h.request(`moderation/${id}/seller`,'POST',{confirmContact:true},admin.cookie)).status,200);
 assert.equal((await h.request(`moderation/${id}`,'POST',{status:'published'},admin.cookie)).status,200);assert.equal(h.sqlite.prepare(catalogQuery).all().length,1);
 assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM marketplace_seller_reviews').get().n,1);assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM marketplace_moderation_log').get().n,1);
 assert.equal((await h.request('listings/'+id,'PATCH',{status:'sold'},owner.cookie)).status,200);assert.equal(h.sqlite.prepare(catalogQuery).all().length,0);
});
test('validação rejeita preço, bairro e consentimento inválidos',async()=>{
 const h=harness();assert.equal((await h.request('register','POST',{...registration(),acceptContact:false})).status,400);assert.equal((await h.request('register','POST',{...registration(),neighborhood:'Outro bairro'})).status,400);
 const owner=await h.request('register','POST',registration());for(const data of [{...offer(),priceCents:-1},{...offer(),priceCents:null},{...offer(),neighborhood:'Manaus'},{...offer(),title:'   '}])assert.equal((await h.request('listings','POST',data,owner.cookie)).status,400);
 assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM marketplace_listings').get().n,0);
});
test('limite de tentativas persiste no banco sem guardar IP e e-mail em texto',async()=>{
 const h=harness();for(let i=0;i<10;i++)await h.request('login','POST',registration());assert.equal((await h.request('login','POST',registration())).status,429);assert(h.sqlite.prepare('SELECT key FROM marketplace_rate_limits').all().every(row=>/^[a-f0-9]{64}$/.test(row.key)));
});

test('identificador aleatório de navegador sem randomUUID também funciona',async()=>{
 const h=harness(),owner=await h.request('register','POST',registration());assert.equal((await h.request('listings','POST',offer('a'.repeat(32)),owner.cookie)).status,201);assert.equal((await h.request('listings','POST',offer('-'.repeat(36)),owner.cookie)).status,400);
});

test('cadastro e login aceitam senha de oito caracteres, preservando hash e sessão',async()=>{
 const h=harness(),data={...registration(),password:'Teste#26'};
 assert.equal((await h.request('register','POST',{...data,password:'curta'})).status,400);
 const registered=await h.request('register','POST',data);assert.equal(registered.status,201);
 assert.equal((await h.request('logout','POST',{},registered.cookie)).status,200);
 const login=await h.request('login','POST',data);assert.equal(login.status,200);assert(login.cookie);
 assert.equal((await h.request('login','POST',{...data,password:'Teste#27'})).status,401);
});

test('API normaliza telefone formatado e rejeita texto inválido',async()=>{
 const h=harness();assert.equal((await h.request('register','POST',{...registration(),whatsapp:'telefone inválido'})).status,400);
 const result=await h.request('register','POST',{...registration(),whatsapp:'+55 (92) 00000-0000'});assert.equal(result.status,201);assert.equal(result.body.account.whatsapp,'5592000000000');assert.equal(h.sqlite.prepare('SELECT whatsapp FROM marketplace_sellers').get().whatsapp,'5592000000000');
});
