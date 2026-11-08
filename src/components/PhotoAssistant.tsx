import {useEffect,useState,type ChangeEvent} from 'react';

type Props={onFile:(file:File|null)=>void;initialPhoto?:File|null;draftMode?:boolean};
export function PhotoPicker({onFile,initialPhoto=null,draftMode=false}:Props){
 const [photo,setPhoto]=useState<File|null>(initialPhoto),[preview,setPreview]=useState(''),[error,setError]=useState('');
 useEffect(()=>{if(!photo){setPreview('');return}const url=URL.createObjectURL(photo);setPreview(url);return ()=>URL.revokeObjectURL(url)},[photo]);
 const changed=(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.currentTarget.files?.[0]||null;setError('');
  if(file&&(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12000000)){setError('Escolha uma foto JPG, PNG ou WebP de até 12 MB.');event.currentTarget.value='';return}
  setPhoto(file);onFile(file);
 };
 return <section className="ai-photo-box" aria-label="Foto do anúncio">
  <h3>Adicione uma foto</h3><p>Uma foto clara ajuda as pessoas a conhecer o produto.</p>
  <label className="ai-photo-picker">Foto do produto (opcional)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={changed}/></label>
  {preview&&<img className="ai-photo-preview" src={preview} alt="Foto escolhida para o anúncio"/>}
  {error&&<p role="alert" className="form-error">{error}</p>}
  <p className="field-help">JPG, PNG ou WebP, até 12 MB. Você preenche as informações abaixo.</p>
  {draftMode&&<p className="field-help">A foto fica disponível enquanto esta página estiver aberta. Se fechar ou atualizar, escolha a foto novamente antes de publicar.</p>}
 </section>;
}
