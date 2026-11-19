import type {Database} from './account.ts';
import {RequestFailure} from './http.ts';
import {normalizeWhatsapp} from '../../src/lib/phone.mjs';

export async function confirmContact(db:Database, adminId:unknown, sellerId:unknown, data:Record<string,unknown>){
  const phone=normalizeWhatsapp(data.whatsapp);
  const code=typeof data.code==='string'?data.code.trim().toLowerCase():'';
  if(!phone||!/^[a-f0-9]{8}$/.test(code)||data.confirmContact!==true)
    throw new RequestFailure('Informe o código recebido do WhatsApp cadastrado.');
  const [updated]=await db.batch([
    db.prepare(`UPDATE marketplace_sellers SET verified_whatsapp=whatsapp,contact_code=NULL,status='approved'
      WHERE id=? AND status!='suspended' AND whatsapp=? AND contact_code=? AND verified_whatsapp IS NOT whatsapp`).bind(sellerId,phone,code),
    db.prepare('INSERT INTO marketplace_seller_reviews(admin_id,seller_id) SELECT ?,? WHERE changes()=1').bind(adminId,sellerId)
  ]);
  if(!(updated as {meta:{changes:number}}).meta.changes)
    throw new RequestFailure('Número ou código já mudou. Confira o remetente e peça o código atual.',409);
}

export async function changeContact(db:Database, sellerId:unknown, data:Record<string,unknown>){
  const phone=normalizeWhatsapp(data.whatsapp);
  if(!phone||typeof data.profileContact!=='boolean'||typeof data.previousWhatsapp!=='string')
    throw new RequestFailure('Informe um WhatsApp brasileiro com DDD e a preferência da vitrine.');
  const updated=await db.prepare(`UPDATE marketplace_sellers SET
    verified_whatsapp=CASE WHEN whatsapp=? THEN verified_whatsapp ELSE NULL END,
    contact_code=CASE WHEN whatsapp=? THEN contact_code ELSE lower(hex(randomblob(4))) END,
    whatsapp=?,profile_contact=? WHERE id=? AND COALESCE(whatsapp,'')=? AND status!='suspended'`)
    .bind(phone,phone,phone,Number(data.profileContact),sellerId,data.previousWhatsapp).run();
  if(!updated.meta.changes)throw new RequestFailure('Seu contato mudou. Atualize a página.',409);
}
