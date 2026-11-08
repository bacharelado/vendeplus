import {useState,type FormEvent} from 'react';
export function ReportListing({listingId}:{listingId:number}){
 const [open,setOpen]=useState(false),[reason,setReason]=useState('spam'),[details,setDetails]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const submit=async(event:FormEvent)=>{
  event.preventDefault();setBusy(true);setNotice('');
  try{const r=await fetch('/api/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({listingId,reason,details}),credentials:'same-origin'});const data=await r.json();if(!r.ok)throw Error(data.error||'Falha ao denunciar');setNotice('Denúncia recebida. Nossa equipe analisará.');setOpen(false)}
  catch(error){setNotice(error instanceof Error?error.message:'Não foi possível enviar a denúncia.')}
  finally{setBusy(false)}
 };
 return <div className="report-listing"><button type="button" className="button outline full" onClick={()=>setOpen(v=>!v)}>Denunciar este anúncio</button>{open&&<form className="panel report-form" onSubmit={submit}><label>Motivo<select value={reason} onChange={e=>setReason(e.target.value)}><option value="spam">Spam</option><option value="fraud">Suspeita de golpe</option><option value="prohibited">Produto ou serviço proibido</option><option value="other">Outro motivo</option></select></label><label>Detalhes (opcional)<textarea value={details} maxLength={500} onChange={e=>setDetails(e.target.value)} placeholder="Conte o que aconteceu sem incluir dados pessoais."/></label><button className="button primary" type="submit" disabled={busy}>{busy?'Enviando…':'Enviar denúncia'}</button></form>}{notice&&<p role="status">{notice}</p>}</div>;
}
