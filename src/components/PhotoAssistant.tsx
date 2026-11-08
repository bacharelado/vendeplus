import {useEffect,useState,type ChangeEvent} from 'react';

export type PhotoAISuggestion={title:string;description:string;category:string;needsReview:true;priceCents:null};
type Props={onSuggestion:(suggestion:PhotoAISuggestion)=>void;onFile?:(file:File|null)=>void;draftMode?:boolean};
async function jpegForAnalysis(file:File):Promise<Blob>{
 if(!file.type.startsWith('image/')||file.size>12_000_000)throw new Error('Escolha uma imagem de até 12 MB.');
 const bitmap=await createImageBitmap(file);
 try{
  const scale=Math.min(1,1024/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Não foi possível preparar esta imagem.');
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(x=>x?resolve(x):reject(new Error('Não foi possível converter a foto.')),'image/jpeg',0.76));
  if(blob.size>1_500_000)throw new Error('Esta foto ainda é muito grande. Escolha outra.');
  return blob;
 }finally{bitmap.close()}
}
export function PhotoAssistant({onSuggestion,onFile,draftMode=false}:Props){
 const [photo,setPhoto]=useState<File|null>(null),[preview,setPreview]=useState(''),[loading,setLoading]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 useEffect(()=>{
  if(!photo){setPreview('');return}
  const url=URL.createObjectURL(photo);setPreview(url);
  return ()=>URL.revokeObjectURL(url);
 },[photo]);
 const analyze=async(file:File)=>{
  setLoading(true);setError('');setNotice('');
  try{
   const jpg=await jpegForAnalysis(file);
   const response=await fetch('/api/photo-analyze',{
    method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'image/jpeg'},
    body:jpg,signal:AbortSignal.timeout(45000)
   });
   const data=await response.json();
   if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'Análise indisponível.');
   if(!data.suggestion)throw new Error('A IA não conseguiu reconhecer o produto.');
   onSuggestion(data.suggestion as PhotoAISuggestion);
   setNotice('Sugestões da IA aplicadas! Confira o texto, informe preço, condição e entrega.');
  }catch(reason){setError(reason instanceof Error?reason.message:'Falha ao analisar a imagem.')}
  finally{setLoading(false)}
 };
 const changed=(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.currentTarget.files?.[0]||null;
  setPhoto(file);onFile?.(file);setNotice('');setError('');
  if(file)void analyze(file);
 };
 return <section className="ai-photo-box" aria-label="Assistente de anúncios com IA">
  <div className="ai-photo-heading"><span className="ai-photo-mark" aria-hidden="true">✦</span><div><h3>Anuncie com uma foto e IA</h3><p>Selecione uma imagem. A IA sugere título, categoria e descrição automaticamente.</p></div></div>
  <label className="ai-photo-picker">Foto do produto
   <input type="file" accept="image/jpeg,image/png,image/webp" onChange={changed} aria-label="Foto para criar anúncio com IA"/>
  </label>
  {preview&&<img className="ai-photo-preview" src={preview} alt="Prévia da foto que você escolheu"/>}
  {photo&&<button type="button" className="button outline" disabled={loading} onClick={()=>void analyze(photo)}>{loading?'Analisando foto…':'Analisar foto novamente'}</button>}
  {loading&&<p role="status" className="ai-photo-status">A IA está examinando a foto. Não feche o formulário.</p>}
  {notice&&<p role="status" className="ai-photo-status">{notice}</p>}
  {error&&<p role="alert" className="form-error">{error}</p>}
  <p className="field-help">A imagem é enviada ao serviço Workers AI da Cloudflare para análise. É necessário estar conectado à sua conta. Não envie documentos ou fotos pessoais. As sugestões não publicam o anúncio sem sua confirmação.</p>
  {draftMode&&<p className="field-help">Rascunhos locais não armazenam a foto: ela permanece disponível para publicação apenas durante esta sessão do site.</p>}
 </section>;
}
