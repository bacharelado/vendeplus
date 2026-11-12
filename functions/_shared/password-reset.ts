import {randomBytes,createHash} from 'node:crypto';
import type {Database} from './account.ts';
export type PasswordResetEnv={RESEND_API_KEY?:string;PASSWORD_RESET_FROM?:string;PASSWORD_RESET_ENABLED?:string};
type Input={db:Database;env:PasswordResetEnv;request:Request;path:string;data:Record<string,unknown>;waitUntil?:(task:Promise<unknown>)=>void;hashPassword:(password:string)=>Promise<string>;rate:(db:Database,key:string,limit:number)=>Promise<void>;sendEmail?:typeof sendResetEmail};
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const accepted={ok:true,message:'Se existir uma conta ativa com esse e-mail, você receberá um link para criar outra senha. Confira também o spam.'};
function configured(env:PasswordResetEnv){
 const from=env.PASSWORD_RESET_FROM?.trim()||'';
 const address=/<([^<>]+)>$/.exec(from)?.[1]||from;
 return env.PASSWORD_RESET_ENABLED==='true'&&Boolean(env.RESEND_API_KEY?.trim())&&!/[\r\n]/.test(from)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)&&!/@(?:.*\.)?resend\.dev$/i.test(address);
}
async function tableReady(db:Database){return Boolean(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='marketplace_password_resets'").first())}
export async function sendResetEmail(env:PasswordResetEnv,email:string,url:string){
 const r=await fetch('https://api.resend.com/emails',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:env.PASSWORD_RESET_FROM,to:[email],subject:'Redefina sua senha do VENDE+',text:'Recebemos um pedido para redefinir sua senha do VENDE+.\n\nAbra este link em até 15 minutos:\n'+url+'\n\nO link só pode ser usado uma vez. Se não foi você, ignore este e-mail. Sua senha continua a mesma.'}),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new Error('RESET_EMAIL_DELIVERY_FAILED');
}
export async function handlePasswordReset({db,env,request,path,data,waitUntil,hashPassword,rate,sendEmail=sendResetEmail}:Input):Promise<Response>{
 if(path==='/password-reset/status'&&request.method==='GET')return reply({available:configured(env)&&await tableReady(db)});
 if(path==='/password-reset/request'&&request.method==='POST'){
  if(!configured(env)||!await tableReady(db))return reply({error:'A recuperação por e-mail ainda não está disponível. Tente novamente mais tarde.'},503);
  const email=typeof data.email==='string'?data.email.trim().toLowerCase():'';
  if(email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))return reply({error:'Informe um e-mail válido.'},400);
  await rate(db,'reset-ip:'+String(request.headers.get('CF-Connecting-IP')||'unknown'),5);
  await rate(db,'reset-email:'+email,3);
  await rate(db,'reset-global',20);
  const token=randomBytes(32).toString('hex'),digest=hash(token);
  const account=await db.prepare("SELECT a.id,a.email FROM marketplace_accounts a JOIN marketplace_sellers s ON s.id=a.id WHERE a.email=? AND s.status!='suspended'").bind(email).first();
  if(account){
   await db.prepare('DELETE FROM marketplace_password_resets WHERE expires_at<=unixepoch() OR used_at IS NOT NULL').run();
   await db.prepare('INSERT INTO marketplace_password_resets(token_hash,account_id,email,expires_at) VALUES (?,?,?,unixepoch()+900)').bind(digest,account.id,account.email).run();
   const origin=new URL(request.url).origin;
   const link=origin+'/#entrar?redefinir='+token;
   const deliver=sendEmail(env,String(account.email),link).catch(async()=>{await db.prepare('DELETE FROM marketplace_password_resets WHERE token_hash=?').bind(digest).run();console.error('VENDEPLUS_RESET_EMAIL_DELIVERY_FAILED')});
   if(waitUntil)waitUntil(deliver);else await deliver;
  }
  return reply(accepted);
 }
 if(path==='/password-reset/confirm'&&request.method==='POST'){
  await rate(db,'reset-confirm:'+String(request.headers.get('CF-Connecting-IP')||'unknown'),10);
  const token=typeof data.token==='string'?data.token:'',password=typeof data.password==='string'?data.password:'';
  if(!/^[a-f0-9]{64}$/.test(token))return reply({error:'Link inválido ou expirado. Solicite outro link.'},400);
  if(password.length<8||password.length>128)return reply({error:'Use uma senha entre 8 e 128 caracteres.'},400);
  if(!await tableReady(db))return reply({error:'Link inválido ou expirado. Solicite outro link.'},400);
  const digest=hash(token);
  const eligible="SELECT r.account_id FROM marketplace_password_resets r JOIN marketplace_accounts a ON a.id=r.account_id AND a.email=r.email JOIN marketplace_sellers s ON s.id=a.id WHERE r.token_hash=? AND r.used_at IS NULL AND r.expires_at>unixepoch() AND s.status!='suspended'";
  const row=await db.prepare(eligible).bind(digest).first();
  if(!row)return reply({error:'Link inválido ou expirado. Solicite outro link.'},400);
  const encoded=await hashPassword(password);
  const result=await db.batch([
   db.prepare('UPDATE marketplace_accounts SET password_hash=? WHERE id=? AND id IN ('+eligible+')').bind(encoded,row.account_id,digest),
   db.prepare('DELETE FROM marketplace_sessions WHERE account_id=? AND EXISTS(SELECT 1 FROM marketplace_accounts WHERE id=? AND password_hash=?)').bind(row.account_id,row.account_id,encoded),
   db.prepare('UPDATE marketplace_password_resets SET used_at=unixepoch() WHERE account_id=? AND EXISTS(SELECT 1 FROM marketplace_accounts WHERE id=? AND password_hash=?)').bind(row.account_id,row.account_id,encoded)
  ]);
  const changed=Number((result[0] as {meta?:{changes?:number}})?.meta?.changes);
  if(changed!==1)return reply({error:'Link inválido ou expirado. Solicite outro link.'},400);
  return new Response(JSON.stringify({ok:true,message:'Senha alterada. Entre novamente com sua nova senha.'}),{headers:{...headers,'Set-Cookie':'__Host-vendeplus=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'}});
 }
 return reply({error:'Recurso não encontrado.'},404);
}
