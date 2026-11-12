import {normalizeWhatsapp} from '../../src/lib/phone.mjs';
import {randomBytes,scrypt,timingSafeEqual,createHash} from 'node:crypto';
import {handlePasswordReset,type PasswordResetEnv} from './password-reset.ts';
import {moderateOffer} from './moderation.ts';
import {removeListingPhoto,type PhotoEnv} from './photo-cleanup.ts';

type Row=Record<string,unknown>;
type Statement={bind:(...values:unknown[])=>Statement;first:()=>Promise<Row|null>;all:()=>Promise<{results:Row[]}>;run:()=>Promise<{meta:{changes:number}}>};
export type Database={prepare:(query:string)=>Statement;batch:(statements:Statement[])=>Promise<unknown[]>};
type Context={request:Request;env:PhotoEnv&PasswordResetEnv&{MARKETPLACE_DB?:Database};waitUntil?:(task:Promise<unknown>)=>void};
const neighborhoods=['Poranga I','Poranga II','Jacarezinho'];
const categories=['Alimentação','Moda','Eletrônicos','Casa','Beleza','Serviços'];
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const derive=(password:string,salt:string)=>new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,32,{N:16384,r:8,p:5,maxmem:32*1024*1024},(error,key)=>error?reject(error):resolve(key)));
export async function passwordHash(password:string){const salt=randomBytes(16).toString('hex');return `scrypt-16384-8-5$${salt}$${(await derive(password,salt)).toString('hex')}`}
export async function passwordMatches(password:string,encoded:string){const [algorithm,salt,key]=encoded.split('$');if(algorithm!=='scrypt-16384-8-5'||!salt||!key||!/^[a-f0-9]{64}$/.test(key))return false;return timingSafeEqual(await derive(password,salt),Buffer.from(key,'hex'))}
const cookie=(token:string,maxAge=604800)=>`__Host-vendeplus=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
const tokenFrom=(request:Request)=>{const value=request.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-vendeplus='))?.split('=')[1];return value&&/^[a-f0-9]{64}$/.test(value)?value:''};
const reply=(data:unknown,status=200,extra:Record<string,string>={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
class Failure extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status}}
function text(value:unknown,min:number,max:number){if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)throw new Failure('Preencha os campos com informações válidas.');return value.trim()}
async function body(request:Request){
 if(request.headers.get('Origin')!==new URL(request.url).origin||request.headers.get('Sec-Fetch-Site')==='cross-site')throw new Failure('Origem da solicitação não permitida.',403);
 if(request.headers.get('Content-Type')?.split(';')[0]!=='application/json')throw new Failure('Envie os dados em JSON.',415);
 if(Number(request.headers.get('Content-Length'))>16384)throw new Failure('Solicitação muito grande.',413);
 const reader=request.body?.getReader();if(!reader)throw new Failure('Dados ausentes.');let size=0;const chunks:Uint8Array[]=[];
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16384){await reader.cancel();throw new Failure('Solicitação muito grande.',413)}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 try{const data=JSON.parse(new TextDecoder().decode(bytes));if(!data||Array.isArray(data)||typeof data!=='object')throw 0;return data as Row}catch{throw new Failure('Dados inválidos.')}
}
async function rate(db:Database,key:string,limit:number){
 const now=Math.floor(Date.now()/1000);
 const result=await db.prepare('INSERT INTO marketplace_rate_limits(key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING attempts').bind(hash(key),now+900,now,now).first();
 if(Number(result?.attempts)>limit)throw new Failure('Muitas tentativas. Aguarde 15 minutos e tente novamente.',429);
 await db.prepare('DELETE FROM marketplace_rate_limits WHERE expires_at < ?').bind(now).run();
}
const accountFields='a.id,a.email,a.neighborhood,a.role,s.display_name AS name,s.status,s.whatsapp';
export async function session(db:Database,request:Request){
 const token=tokenFrom(request);if(!token)return null;
 return db.prepare(`SELECT ${accountFields} FROM marketplace_sessions t JOIN marketplace_accounts a ON a.id=t.account_id JOIN marketplace_sellers s ON s.id=a.id WHERE t.token_hash=? AND t.expires_at>unixepoch() AND s.status!='suspended'`).bind(hash(token)).first();
}
function sessionStatement(db:Database,id:string,token:string){return db.prepare('INSERT INTO marketplace_sessions(token_hash,account_id,expires_at) VALUES (?,?,unixepoch()+604800)').bind(hash(token),id)}
function listingData(data:Row){
 const title=text(data.title,5,90),description=text(data.description,10,2000),fulfillment=text(data.fulfillment,1,180);
 if(!categories.includes(String(data.category))||!['Novo','Usado','Não aplicável'].includes(String(data.condition))||!neighborhoods.includes(String(data.neighborhood)))throw new Failure('Categoria, condição ou bairro inválido.');
 if(data.priceCents!==null&&(!Number.isSafeInteger(data.priceCents)||Number(data.priceCents)<=0||Number(data.priceCents)>100000000)||data.priceCents===null&&data.category!=='Serviços')throw new Failure('Informe um preço válido.');
 return [title,description,data.priceCents,data.category,data.condition,fulfillment];
}
export async function handleAccount(context:Context){
 const {request,env}=context;
 if(!env.MARKETPLACE_DB)return reply({error:'Serviço temporariamente indisponível.'},503);
 const db=env.MARKETPLACE_DB,path=new URL(request.url).pathname.replace(/\/$/,'').replace('/api/account','');
 try{
  if(!['GET','POST','PATCH'].includes(request.method))return reply({error:'Método não permitido.'},405,{Allow:'GET, POST, PATCH'});
  const data=request.method==='GET'?{}:await body(request);
  if(path.startsWith('/password-reset/'))return await handlePasswordReset({db,env,request,path,data,waitUntil:context.waitUntil?.bind(context),hashPassword:passwordHash,rate});
  if(path==='/session'&&request.method==='GET')return reply({account:await session(db,request)});
  if((path==='/register'||path==='/login')&&request.method==='POST'){
   const email=text(data.email,5,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Failure('Informe um e-mail válido.');
   const password=typeof data.password==='string'?data.password:'';if(password.length<8||password.length>128)throw new Failure('Use uma senha entre 8 e 128 caracteres.');
   await rate(db,`auth-ip:${request.headers.get('CF-Connecting-IP')||'unknown'}`,20);
   await rate(db,`auth-email:${email}`,10);
   const token=randomBytes(32).toString('hex');
   if(path==='/register'){
    const name=text(data.name,2,80),whatsapp=normalizeWhatsapp(data.whatsapp);
    if(!whatsapp||!neighborhoods.includes(String(data.neighborhood))||data.acceptContact!==true)throw new Failure('Informe o bairro, um WhatsApp brasileiro com DDD e autorize sua divulgação nos anúncios aprovados.');
    const encoded=await passwordHash(password),id=crypto.randomUUID();
    try{await db.batch([db.prepare('INSERT INTO marketplace_sellers(id,display_name,whatsapp) VALUES (?,?,?)').bind(id,name,whatsapp),db.prepare('INSERT INTO marketplace_accounts(id,email,password_hash,neighborhood) VALUES (?,?,?,?)').bind(id,email,encoded,data.neighborhood),sessionStatement(db,id,token)])}
    catch(error){if(await db.prepare('SELECT id FROM marketplace_accounts WHERE email=?').bind(email).first())throw new Failure('Não foi possível cadastrar com esse e-mail. Tente entrar na sua conta.',409);throw error}
    return reply({account:await db.prepare(`SELECT ${accountFields} FROM marketplace_accounts a JOIN marketplace_sellers s ON s.id=a.id WHERE a.id=?`).bind(id).first()},201,{'Set-Cookie':cookie(token)});
   }
   const credentials=await db.prepare('SELECT a.id,a.password_hash,s.status FROM marketplace_accounts a JOIN marketplace_sellers s ON s.id=a.id WHERE a.email=?').bind(email).first();
   const dummy='scrypt-16384-8-5$00000000000000000000000000000000$'+'0'.repeat(64);
   const valid=await passwordMatches(password,String(credentials?.password_hash||dummy));
   if(!valid||!credentials||credentials.status==='suspended')throw new Failure('E-mail ou senha inválidos.',401);
   await db.batch([db.prepare('DELETE FROM marketplace_sessions WHERE account_id=? AND (expires_at<=unixepoch() OR token_hash NOT IN (SELECT token_hash FROM marketplace_sessions WHERE account_id=? ORDER BY expires_at DESC LIMIT 4))').bind(credentials.id,credentials.id),sessionStatement(db,String(credentials.id),token)]);
   return reply({account:await session(db,new Request(request.url,{headers:{Cookie:`__Host-vendeplus=${token}`}}))},200,{'Set-Cookie':cookie(token)});
  }
  if(path==='/logout'&&request.method==='POST'){await db.prepare('DELETE FROM marketplace_sessions WHERE token_hash=?').bind(hash(tokenFrom(request))).run();return reply({ok:true},200,{'Set-Cookie':cookie('',0)})}
  const account=await session(db,request);if(!account)throw new Failure('Entre na sua conta para continuar.',401);
  if(path==='/listings'&&request.method==='GET'){
   const result=await db.prepare('SELECT l.id,l.title,l.description,l.price_cents AS priceCents,l.category,l.condition,l.fulfillment,l.status,d.neighborhood FROM marketplace_listings l LEFT JOIN marketplace_listing_details d ON d.listing_id=l.id WHERE l.seller_id=? AND l.status!=\'removed\' ORDER BY l.created_at DESC,l.id DESC LIMIT 200').bind(account.id).all();
   return reply({listings:result.results});
  }
  if(path==='/listings'&&request.method==='POST'){
   const values=listingData(data),requestId=text(data.requestId,32,36);if(!/^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(requestId))throw new Failure('Identificador da solicitação inválido.');
   const previous=await db.prepare('SELECT l.id,l.status FROM marketplace_listings l JOIN marketplace_listing_details d ON d.listing_id=l.id WHERE d.seller_id=? AND d.request_id=?').bind(account.id,requestId).first();if(previous)return reply({id:previous.id,status:previous.status});
   await rate(db,`listing:${account.id}`,10);
   const count=await db.prepare("SELECT count(*) AS total FROM marketplace_listings WHERE seller_id=? AND status NOT IN ('removed','sold')").bind(account.id).first();if(Number(count?.total)>=50)throw new Failure('Você atingiu o limite de 50 anúncios ativos.',409);
   const id=Number.parseInt(randomBytes(6).toString('hex'),16);
   const status=moderateOffer(String(values[0]),String(values[1]))==='review'?'pending':'published';
   await db.batch([db.prepare("INSERT INTO marketplace_listings(id,seller_id,title,description,price_cents,category,condition,fulfillment,status) VALUES (?,?,?,?,?,?,?,?,?)").bind(id,account.id,...values,status),db.prepare('INSERT INTO marketplace_listing_details(listing_id,neighborhood,request_id,seller_id) VALUES (?,?,?,?)').bind(id,data.neighborhood,requestId,account.id),db.prepare('INSERT INTO marketplace_listing_events(listing_id,seller_id,event) VALUES (?,?,?)').bind(id,account.id,status==='published'?'auto_published':'flagged_for_review')]);
   return reply({id,status},201);
  }
  if(path==='/profile'&&request.method==='GET'){
   const profile=await db.prepare("SELECT s.display_name AS name,s.whatsapp,a.neighborhood,COALESCE(p.bio,'') AS bio FROM marketplace_sellers s JOIN marketplace_accounts a ON a.id=s.id LEFT JOIN marketplace_seller_profiles p ON p.seller_id=s.id WHERE s.id=?").bind(account.id).first();
   return reply({profile});
  }
  if(path==='/profile'&&request.method==='PATCH'){
   const name=text(data.name,2,80),bio=typeof data.bio==='string'?data.bio.trim():'';
   if(bio.length>600)throw new Failure('Descrição muito longa.');
   await db.batch([db.prepare('UPDATE marketplace_sellers SET display_name=? WHERE id=?').bind(name,account.id),db.prepare('INSERT INTO marketplace_seller_profiles(seller_id,bio) VALUES (?,?) ON CONFLICT(seller_id) DO UPDATE SET bio=excluded.bio').bind(account.id,bio)]);
   return reply({ok:true});
  }
  const own=/^\/listings\/(\d+)$/.exec(path);
  if(own&&request.method==='PATCH'){
   const id=Number(own[1]);
   const current=await db.prepare("SELECT status,image_url AS image FROM marketplace_listings WHERE id=? AND seller_id=?").bind(id,account.id).first();
   if(!current||['removed','rejected'].includes(String(current.status)))throw new Failure('Anúncio não encontrado.',404);
   if(data.action==='edit'){
    const values=listingData(data);
    const status=moderateOffer(String(values[0]),String(values[1]))==='review'?'pending':current.status==='pending'?'published':String(current.status);
    await db.batch([db.prepare('INSERT INTO marketplace_listing_events(listing_id,seller_id,event) VALUES (?,?,?)').bind(id,account.id,'edited'),db.prepare('UPDATE marketplace_listings SET title=?,description=?,price_cents=?,category=?,condition=?,fulfillment=?,status=? WHERE id=? AND seller_id=?').bind(...values,status,id,account.id),db.prepare('UPDATE marketplace_listing_details SET neighborhood=? WHERE listing_id=? AND seller_id=?').bind(data.neighborhood,id,account.id)]);
    return reply({ok:true,status});
   }
   if(!['paused','sold','removed','published'].includes(String(data.status)))throw new Failure('Ação inválida.');
   if(data.status==='published'&&current.status!=='paused')throw new Failure('Somente anúncios pausados podem ser reativados.',409);
   if(data.status==='paused'&&current.status!=='published')throw new Failure('Somente anúncios publicados podem ser pausados.',409);
   if(data.status==='sold'&&!['published','paused'].includes(String(current.status)))throw new Failure('O anúncio não pode ser marcado como vendido.',409);
   const result=await db.prepare('UPDATE marketplace_listings SET status=? WHERE id=? AND seller_id=? AND status=?').bind(data.status,id,account.id,current.status).run();if(!result.meta.changes)throw new Failure('O anúncio mudou. Atualize.',409);
   await db.prepare('INSERT INTO marketplace_listing_events(listing_id,seller_id,event) VALUES (?,?,?)').bind(id,account.id,String(data.status)).run();
   if(data.status==='removed'){
    try{await removeListingPhoto(db,env,current.image,new URL(request.url).origin,id)}
    catch{console.error('VENDEPLUS_PHOTO_CLEANUP_PENDING',{listingId:id});return reply({ok:true,warning:'Anúncio removido. A limpeza da foto está pendente.'})}
   }
   return reply({ok:true});
  }
  if(path==='/password'&&request.method==='POST'){
    const oldPassword=typeof data.oldPassword==='string'?data.oldPassword:'',newPassword=typeof data.newPassword==='string'?data.newPassword:'';
    if(newPassword.length<8||newPassword.length>128)throw new Failure('Nova senha deve ter entre 8 e 128 caracteres.');
    await rate(db,'password:'+account.id,8);
    const row=await db.prepare('SELECT password_hash FROM marketplace_accounts WHERE id=?').bind(account.id).first();
    if(!row||!await passwordMatches(oldPassword,String(row.password_hash)))throw new Failure('Senha atual incorreta.',401);
    const next=await passwordHash(newPassword);
    const resetTable=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='marketplace_password_resets'").first();
    await db.batch([
      db.prepare('UPDATE marketplace_accounts SET password_hash=? WHERE id=?').bind(next,account.id),
      db.prepare('DELETE FROM marketplace_sessions WHERE account_id=? AND token_hash!=?').bind(account.id,hash(tokenFrom(request))),
      ...(resetTable?[db.prepare('UPDATE marketplace_password_resets SET used_at=unixepoch() WHERE account_id=?').bind(account.id)]:[])
    ]);
    return reply({ok:true});
  }
  if(path==='/admin/sellers'&&request.method==='GET'){
    if(account.role!=='admin')throw new Failure('Acesso restrito.',403);
    const items=await db.prepare("SELECT a.id,a.email,a.neighborhood,a.role,a.created_at AS createdAt,s.display_name AS name,s.status FROM marketplace_accounts a JOIN marketplace_sellers s ON s.id=a.id ORDER BY a.created_at DESC LIMIT 200").all();
    return reply({sellers:items.results});
  }
  if(path==='/admin/listings'&&request.method==='GET'){
    if(account.role!=='admin')throw new Failure('Acesso restrito.',403);
    const items=await db.prepare("SELECT l.id,l.title,l.status,l.created_at AS createdAt,s.display_name AS seller FROM marketplace_listings l JOIN marketplace_sellers s ON s.id=l.seller_id WHERE l.status!='removed' ORDER BY l.created_at DESC LIMIT 200").all();
    return reply({listings:items.results});
  }
  const adminListing=/^\/admin\/listings\/(\d+)$/.exec(path);
  if(adminListing&&request.method==='POST'){
    if(account.role!=='admin')throw new Failure('Acesso restrito.',403);
    const id=Number(adminListing[1]);
    if(data.status!=='removed')throw new Failure('Ação inválida.');
    const listing=await db.prepare("SELECT seller_id FROM marketplace_listings WHERE id=? AND status!='removed'").bind(id).first();
    if(!listing)throw new Failure('Anúncio não encontrado.',404);
    await db.batch([
      db.prepare("UPDATE marketplace_listings SET status='removed' WHERE id=? AND status!='removed'").bind(id),
      db.prepare("INSERT INTO marketplace_listing_events(listing_id,seller_id,event) VALUES (?,?,?)").bind(id,listing.seller_id,'admin_removed')
    ]);
    return reply({ok:true});
  }
  if(path==='/admin/stats'&&request.method==='GET'){
    if(account.role!=='admin')throw new Failure('Acesso restrito.',403);
    const sellers=await db.prepare('SELECT COUNT(*) AS total FROM marketplace_accounts').first();
    const published=await db.prepare("SELECT COUNT(*) AS total FROM marketplace_listings l JOIN marketplace_sellers s ON s.id=l.seller_id WHERE l.status='published' AND s.status!='suspended'").first();
    const reports=await db.prepare("SELECT COUNT(*) AS total FROM marketplace_reports WHERE status='open'").first();
    const listings=await db.prepare("SELECT COUNT(*) AS total FROM marketplace_listings WHERE status!='removed'").first();
    return reply({sellers:Number(sellers?.total||0),published:Number(published?.total||0),reports:Number(reports?.total||0),listings:Number(listings?.total||0)});
  }
  if(path==='/admin/reports'&&request.method==='GET'){
    if(account.role!=='admin')throw new Failure('Acesso restrito.',403);
    const queue=await db.prepare("SELECT r.id,r.listing_id AS listingId,r.reason,r.details,r.created_at AS createdAt,l.title,l.seller_id AS sellerId,l.status AS listingStatus FROM marketplace_reports r JOIN marketplace_listings l ON l.id=r.listing_id WHERE r.status='open' ORDER BY r.created_at DESC LIMIT 100").all();
    return reply({reports:queue.results});
  }
  const reportReview=/^\/admin\/reports\/(\d+)$/.exec(path);
  if(reportReview&&request.method==='POST'){
    if(account.role!=='admin')throw new Failure('Acesso restrito.',403);
    if(!['dismissed','removed'].includes(String(data.decision)))throw new Failure('Decisão inválida.');
    const id=Number(reportReview[1]);
    const report=await db.prepare("SELECT listing_id FROM marketplace_reports WHERE id=? AND status='open'").bind(id).first();
    if(!report)throw new Failure('Denúncia não encontrada.',404);
    const statements=[db.prepare("UPDATE marketplace_reports SET status='closed',decision=?,resolved_by=?,resolved_at=unixepoch() WHERE id=? AND status='open'").bind(data.decision,account.id,id)];
    if(data.decision==='removed')statements.push(db.prepare("UPDATE marketplace_listings SET status='removed' WHERE id=? AND status!='removed'").bind(report.listing_id));
    await db.batch(statements);
    return reply({ok:true});
  }
  const adminSeller=/^\/admin\/sellers\/([a-f0-9-]{36})$/.exec(path);
  if(adminSeller&&request.method==='POST'){
    if(account.role!=='admin')throw new Failure('Acesso restrito.',403);
    if(adminSeller[1]===account.id)throw new Failure('Não é permitido bloquear a própria conta.',409);
    if(!['suspended','approved'].includes(String(data.status)))throw new Failure('Status inválido.');
    const update=await db.prepare('UPDATE marketplace_sellers SET status=? WHERE id=?').bind(data.status,adminSeller[1]).run();
    if(!update.meta.changes)throw new Failure('Vendedor não encontrado.',404);
    if(data.status==='suspended')await db.prepare('DELETE FROM marketplace_sessions WHERE account_id=?').bind(adminSeller[1]).run();
    return reply({ok:true});
  }
  if(path.startsWith('/moderation')){
   if(account.role!=='admin')throw new Failure('Acesso restrito à administração.',403);
   if(path==='/moderation'&&request.method==='GET')return reply({listings:(await db.prepare("SELECT l.id,l.title,l.description,l.price_cents AS priceCents,l.category,l.condition,l.fulfillment,s.display_name AS seller,s.whatsapp,s.status AS sellerStatus FROM marketplace_listings l JOIN marketplace_sellers s ON s.id=l.seller_id WHERE l.status='pending' ORDER BY l.created_at LIMIT 100").all()).results});
   const sellerReview=/^\/moderation\/(\d+)\/seller$/.exec(path);
   if(sellerReview&&request.method==='POST'){
    if(data.confirmContact!==true)throw new Failure('Confirme a revisão do cadastro e a propriedade do WhatsApp.');
    const listing=await db.prepare("SELECT seller_id FROM marketplace_listings WHERE id=? AND status='pending'").bind(Number(sellerReview[1])).first();if(!listing)throw new Failure('Anúncio não encontrado.',404);
    await db.batch([db.prepare("INSERT INTO marketplace_seller_reviews(admin_id,seller_id) SELECT ?,id FROM marketplace_sellers WHERE id=? AND status='pending'").bind(account.id,listing.seller_id),db.prepare("UPDATE marketplace_sellers SET status='approved' WHERE id=? AND status='pending'").bind(listing.seller_id)]);
    return reply({ok:true});
   }
   const target=/^\/moderation\/(\d+)$/.exec(path);
   if(target&&request.method==='POST'){
    if(!['published','rejected'].includes(String(data.status)))throw new Failure('Decisão inválida.');
    const id=Number(target[1]);
    const listing=await db.prepare("SELECT seller_id FROM marketplace_listings WHERE id=? AND status='pending'").bind(id).first();if(!listing)throw new Failure('Anúncio pendente não encontrado.',404);
    if(data.status==='published'){
     const seller=await db.prepare('SELECT status FROM marketplace_sellers WHERE id=?').bind(listing.seller_id).first();
     if(seller?.status!=='approved')throw new Failure('O vendedor precisa ser aprovado pela administração antes da publicação.',409);
    }
    await db.batch([db.prepare("INSERT INTO marketplace_moderation_log(admin_id,listing_id,action) SELECT ?,id,? FROM marketplace_listings WHERE id=? AND status='pending'").bind(account.id,data.status,id),db.prepare("UPDATE marketplace_listings SET status=? WHERE id=? AND status='pending'").bind(data.status,id)]);
    return reply({ok:true});
   }
  }
  return reply({error:'Recurso não encontrado.'},404);
 }catch(error){return error instanceof Failure?reply({error:error.message},error.status):reply({error:'Serviço temporariamente indisponível. Tente novamente.'},503)}
}
