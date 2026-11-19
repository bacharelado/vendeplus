import type {Database} from './account.ts';
import {RequestFailure} from './http.ts';

export async function reportQueue(db:Database,status:'open'|'closed'){
  const result=await db.prepare(`SELECT 'listing' AS kind,r.id AS id,r.listing_id AS listingId,l.seller_id AS sellerId,l.title,l.status AS listingStatus,
      r.reason,r.details,r.created_at AS createdAt,r.decision,r.resolved_at AS resolvedAt,r.resolved_by AS resolvedBy
    FROM marketplace_reports r JOIN marketplace_listings l ON l.id=r.listing_id WHERE r.status=?
    UNION ALL SELECT 'seller',r.id,NULL,r.seller_id,s.display_name,s.status,
      r.reason,r.details,r.created_at,r.decision,r.resolved_at,r.resolved_by
    FROM marketplace_seller_reports r JOIN marketplace_sellers s ON s.id=r.seller_id WHERE r.status=?
    ORDER BY ${status==='open'?'createdAt ASC':'resolvedAt DESC'},kind,id LIMIT 100`).bind(status,status).all();
  return result.results;
}

export async function decideReport(db:Database,admin:unknown,id:number,kind:'seller'|'listing',decision:unknown){
  const seller=kind==='seller';
  if(decision!=='dismissed'&&decision!==(seller?'suspended':'removed'))throw new RequestFailure('Decisão inválida.');
  const table=seller?'marketplace_seller_reports':'marketplace_reports';
  const target=seller?'seller_id':'listing_id';
  const row=await db.prepare(`SELECT ${target} AS target FROM ${table} WHERE id=? AND status='open'`).bind(id).first();
  if(!row)throw new RequestFailure('Denúncia aberta não encontrada.',404);
  if(decision==='suspended'&&row.target===admin)throw new RequestFailure('Não é permitido suspender a própria conta.',409);
  const actions=[db.prepare(`UPDATE ${table} SET status='closed',decision=?,resolved_at=unixepoch(),resolved_by=? WHERE id=? AND status='open'`).bind(decision,admin,id)];
  if(decision==='suspended')actions.push(
    db.prepare("UPDATE marketplace_sellers SET status='suspended' WHERE id=? AND changes()=1").bind(row.target),
    db.prepare('DELETE FROM marketplace_sessions WHERE account_id=? AND changes()=1').bind(row.target)
  );
  if(decision==='removed')actions.push(
    db.prepare("UPDATE marketplace_listings SET status='removed' WHERE id=? AND status!='removed' AND changes()=1").bind(row.target),
    db.prepare("INSERT INTO marketplace_listing_events(listing_id,seller_id,event) SELECT id,seller_id,'admin_removed' FROM marketplace_listings WHERE id=? AND changes()=1").bind(row.target)
  );
  const [closed]=await db.batch(actions);
  if(!(closed as {meta:{changes:number}}).meta.changes)throw new RequestFailure('A denúncia já recebeu uma decisão.',409);
  return decision==='removed'?Number(row.target):null;
}
