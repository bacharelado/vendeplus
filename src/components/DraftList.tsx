import {useEffect,useState} from 'react';
import type {Draft} from '../data/marketplace';
import {readDrafts,writeDrafts} from '../lib/drafts.mjs';
import {formatBRL} from '../lib/pricing.mjs';
function saved():Draft[]{try{return readDrafts(localStorage)}catch{return []}}
export function DraftList(){
 const [drafts,setDrafts]=useState(saved),[error,setError]=useState('');
 useEffect(()=>{const reload=()=>setDrafts(saved());window.addEventListener('storage',reload);return ()=>window.removeEventListener('storage',reload)},[]);
 const remove=(draft:Draft)=>{
  if(!window.confirm('Excluir o rascunho “'+draft.title+'” deste navegador?'))return;
  try{const next=saved().filter(item=>item.id!==draft.id);writeDrafts(localStorage,next);setDrafts(next);setError('')}catch{setError('Não foi possível excluir o rascunho.')}
 };
 return <section className="area-drafts" aria-label="Meus rascunhos"><div className="section-heading"><h2>Rascunhos neste navegador</h2><a className="text-link" href="#publicar">Novo anúncio</a></div>{error&&<p className="form-error" role="alert">{error}</p>}{drafts.length?<div className="draft-stack">{drafts.map(draft=><article className="panel draft-card" key={draft.id}><div className="draft-info"><span className="draft-status">Ainda não publicado</span><h3>{draft.title}</h3><p>{formatBRL(draft.priceCents)} · {draft.category}</p><small>Atualizado em {new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(draft.updatedAt)}</small></div><div className="draft-actions"><a className="button primary" href={'#publicar?rascunho='+draft.id}>Continuar anúncio</a><button type="button" className="button outline" onClick={()=>remove(draft)}>Excluir</button></div></article>)}</div>:<p className="account-notice">Você não tem rascunhos salvos neste navegador.</p>}<p className="field-help">Rascunhos ficam apenas neste navegador. Não são públicos. Ao continuar, escolha a foto novamente.</p></section>;
}
