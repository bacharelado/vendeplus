import {createHash,createHmac} from 'node:crypto';
import {RequestFailure} from './http.ts';
type Statement={bind:(...args:unknown[])=>Statement;first:()=>Promise<Record<string,unknown>|null>;run:()=>Promise<unknown>};
export type ReportDB={prepare:(sql:string)=>Statement};

export function reportFields(data:Record<string,unknown>,kind:'listing'|'seller'){
  const reasons=['spam','fraud','prohibited','other',...(kind==='seller'?['impersonation']:[])];
  const details=data.details===undefined?'':typeof data.details==='string'?data.details.trim():null;
  if(typeof data.reason!=='string'||!reasons.includes(data.reason)||details===null||details.length>500)
    throw new RequestFailure('Denúncia inválida.');
  return {reason:data.reason,details};
}

export async function reporterForToday(db:ReportDB,request:Request){
  const now=Math.floor(Date.now()/1000),day=Math.floor(now/86400);
  const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
  const secret=await db.prepare(`INSERT INTO marketplace_report_salts(day,salt) VALUES (?,lower(hex(randomblob(32))))
    ON CONFLICT(day) DO UPDATE SET day=excluded.day RETURNING salt`).bind(day).first();
  if(typeof secret?.salt!=='string')throw new Error('Registro de denúncias indisponível.');
  const reporter=createHmac('sha256',secret.salt).update(request.headers.get('CF-Connecting-IP')||'unknown').digest('hex');
  await db.prepare('DELETE FROM marketplace_report_salts WHERE day<?').bind(day).run();
  const quota=await db.prepare(`INSERT INTO marketplace_rate_limits(key,attempts,expires_at) VALUES (?,1,?)
    ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts`).bind(hash('reports:'+reporter),(day+1)*86400).first();
  if(Number(quota?.attempts)>10)throw new RequestFailure('Limite diário de denúncias atingido.',429);
  return reporter;
}
