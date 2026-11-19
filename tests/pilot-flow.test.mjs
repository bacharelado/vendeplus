import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {database} from './helpers/database.mjs';
import {handleAccount} from '../functions/_shared/account.ts';
import {onRequest as contact} from '../functions/api/contact.ts';
import {onRequest as catalog} from '../functions/api/listings.ts';
import {onRequest as showcase} from '../functions/api/sellers/[[path]].ts';
import {onRequest as reportListing} from '../functions/api/reports.ts';

const origin='https://preview.vendeplus.pages.dev',phone='5592999991234',newPhone='5592999996789';
function fixture(t){
 const {db,sqlite}=database();t.after(()=>sqlite.close());
 const accounts=['seller','admin','visitor'].map(role=>{
  const id=crypto.randomUUID(),token=crypto.randomUUID().replaceAll('-','').repeat(2);
  sqlite.prepare('INSERT INTO marketplace_sellers(id,display_name,whatsapp) VALUES (?,?,?)').run(id,'Pessoa '+role,phone);
  sqlite.prepare('INSERT INTO marketplace_accounts(id,email,password_hash,neighborhood,role) VALUES (?,?,?, ?,?)').run(id,role+'@example.invalid','test','Poranga II',role==='admin'?'admin':'seller');
  sqlite.prepare('INSERT INTO marketplace_sessions(token_hash,account_id,expires_at) VALUES (?,?,unixepoch()+600)').run(createHash('sha256').update(token).digest('hex'),id);
  return {id,cookie:'__Host-vendeplus='+token};
 });
 const [seller,admin,visitor]=accounts,env={MARKETPLACE_DB:db};
 function call(handler,path,{method='GET',data,cookie='',headers={},raw}={}){
  return handler({request:new Request(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,...headers},body:raw??(data===undefined?undefined:JSON.stringify(data))}),env});
 }
 const account=(path,as=admin,method='GET',data)=>call(handleAccount,'/api/account/'+path,{method,data,cookie:as.cookie});
 const profile=async()=>(await (await account('profile',seller)).json()).profile;
 async function verify(number=phone){
  return account('admin/sellers/'+seller.id+'/contact',admin,'POST',{confirmContact:true,whatsapp:number,code:(await profile()).contactCode});
 }
 function offer(){
  sqlite.prepare("INSERT INTO marketplace_listings(id,seller_id,title,description,price_cents,category,condition,fulfillment,status) VALUES (1,?,'Mesa do bairro','Mesa usada no bairro',2500,'Casa','Usado','Retirada','published')").run(seller.id);
 }
 return {sqlite,db,call,seller,admin,visitor,account,profile,verify,offer};
}

test('somente o número comprovado abre contato no anúncio e a vitrine vazia exige autorização própria',async t=>{
 const h=fixture(t),link='/api/contact?seller='+h.seller.id,listing='/api/contact?listing=1';
 const publicProfile=async()=>(await h.call(showcase,'/api/sellers/'+h.seller.id)).json();
 assert.equal((await publicProfile()).seller.canContact,false);
 assert.equal((await h.call(contact,link)).status,404);
 h.offer();
 assert.equal((await h.call(contact,listing)).status,404);
 assert.equal((await h.verify()).status,200);
 let response=await h.call(contact,listing);
 assert.equal(response.status,302);assert.equal(response.headers.get('Cache-Control'),'no-store');
 const dest=new URL(response.headers.get('Location'));assert.equal(dest.origin,'https://wa.me');assert.equal(dest.pathname,'/'+phone);
 assert.match(dest.searchParams.get('text'),/Mesa do bairro.*\/#anuncio-1/);
 assert.equal((await h.call(contact,link)).status,404);
 const offers=await (await h.call(catalog,'/api/listings')).json(),shop=await publicProfile();
 assert.equal(offers.listings[0].canContact,true);assert.equal(shop.listings[0].canContact,true);
 assert.ok(!JSON.stringify([offers,shop]).includes(phone));assert.ok(!JSON.stringify(shop).includes('contactCode'));
 assert.equal((await h.account('contact',h.seller,'PATCH',{whatsapp:phone,previousWhatsapp:phone,profileContact:true})).status,200);
 h.sqlite.exec("UPDATE marketplace_listings SET status='paused'");
 assert.equal((await h.call(contact,listing)).status,404);assert.equal((await publicProfile()).seller.activeListings,0);
 assert.equal((await publicProfile()).seller.canContact,true);assert.equal((await h.call(contact,link)).status,302);
 await h.account('contact',h.seller,'PATCH',{whatsapp:phone,previousWhatsapp:phone,profileContact:false});
 assert.equal((await h.call(contact,link)).status,404);
});

test('troca de número invalida código e prova anteriores e reativar respeita a confirmação real',async t=>{
 const h=fixture(t);h.offer();
 const action='admin/sellers/'+h.seller.id,old=(await h.profile()).contactCode;
 const attempt=(as,number,code)=>h.account(action+'/contact',as,'POST',{whatsapp:number,code,confirmContact:true});
 assert.equal((await attempt(h.seller,phone,old)).status,403);
 assert.equal((await attempt(h.admin,newPhone,old)).status,409);
 assert.equal((await h.verify()).status,200);
 assert.equal((await attempt(h.admin,phone,old)).status,409);
 await h.account('contact',h.seller,'PATCH',{whatsapp:newPhone,previousWhatsapp:phone,profileContact:true});
 assert.equal((await h.call(contact,'/api/contact?listing=1')).status,404);
 assert.equal((await attempt(h.admin,newPhone,old)).status,409);
 const next=(await h.profile()).contactCode;
 assert.equal((await h.account(action,h.admin,'POST',{status:'suspended'})).status,200);
 assert.equal((await attempt(h.admin,newPhone,next)).status,409);
 assert.equal((await h.account(action,h.admin,'POST',{status:'approved'})).status,200);
 assert.equal((await h.call(contact,'/api/contact?listing=1')).status,404);
 assert.equal((await attempt(h.admin,newPhone,next)).status,200);
 assert.equal(new URL((await h.call(contact,'/api/contact?listing=1')).headers.get('Location')).pathname,'/'+newPhone);
 await h.account(action,h.admin,'POST',{status:'suspended'});
 assert.equal((await h.call(contact,'/api/contact?seller='+h.seller.id)).status,404);
 await h.account(action,h.admin,'POST',{status:'approved'});
 assert.equal((await h.call(contact,'/api/contact?seller='+h.seller.id)).status,302);
});

test('fila combina IDs das duas tabelas e arquiva ou suspende com decisão única e histórica',async t=>{
 const h=fixture(t);h.offer();
 const send=(handler,path,data)=>h.call(handler,path,{method:'POST',data});
 assert.equal((await send(showcase,'/api/sellers/'+h.seller.id+'/report',{reason:'impersonation'})).status,201);
 assert.equal((await send(reportListing,'/api/reports',{listingId:1,reason:'spam'})).status,201);
 assert.equal((await (await h.account('admin/stats')).json()).reports,2);
 const queue=await (await h.account('admin/reports')).json();
 assert.deepEqual(queue.reports.map(r=>[r.kind,r.id]).sort(),[['listing',1],['seller',1]]);
 assert.equal((await h.account('admin/reports/seller/1',h.visitor,'POST',{decision:'suspended'})).status,403);
 assert.equal((await h.account('admin/reports/1',h.admin,'POST',{decision:'dismissed'})).status,200);
 assert.equal((await h.account('admin/reports/seller/1',h.admin,'POST',{decision:'suspended'})).status,200);
 assert.equal((await h.account('admin/reports/seller/1',h.admin,'POST',{decision:'dismissed'})).status,404);
 assert.equal((await (await h.account('admin/stats')).json()).reports,0);
 const history=(await (await h.account('admin/reports?status=closed')).json()).reports;
 assert.deepEqual(history.map(r=>r.decision).sort(),['dismissed','suspended']);
 assert.ok(history.every(r=>r.resolvedBy===h.admin.id&&r.resolvedAt>0));
 assert.equal((await h.account('profile',h.seller)).status,401);
 assert.equal((await h.call(showcase,'/api/sellers/'+h.seller.id)).status,404);
});

test('denúncia de perfil valida origem, corpo e limite diário e diferencia duplicata de falha no D1',async t=>{
 const h=fixture(t),url='/api/sellers/'+h.seller.id+'/report';
 const post=(extra={})=>h.call(showcase,url,{method:'POST',data:{reason:'fraud'},...extra});
 assert.equal((await post({headers:{Origin:'https://outra.invalid'}})).status,403);
 assert.equal((await post({raw:'x'.repeat(2100)})).status,413);
 assert.equal((await post({raw:'{'})).status,400);
 assert.equal((await post({data:{reason:'other',details:12}})).status,400);
 assert.equal((await post()).status,201);
 for(let i=1;i<10;i++)assert.equal((await post()).status,409);
 assert.equal((await post()).status,429);
 h.sqlite.exec('DROP TABLE marketplace_seller_reports');
 assert.equal((await post({headers:{'CF-Connecting-IP':'192.0.2.17'}})).status,503);
});
