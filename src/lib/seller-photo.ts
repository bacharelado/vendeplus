async function preparePhoto(file:File):Promise<Blob>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>12000000)throw new Error('Selecione uma foto JPG, PNG ou WebP de até 12 MB.');
 let bitmap:ImageBitmap;
 try{bitmap=await createImageBitmap(file)}catch{throw new Error('Não foi possível abrir a foto. Escolha outra imagem.')}
 try{
  const ratio=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*ratio));
  canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Seu navegador não conseguiu processar a foto.');
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  for(let attempt=0;attempt<6;attempt++){
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Não foi possível preparar a foto.')),'image/png'));
   if(blob.size<=3145728)return blob;
   const nextWidth=Math.max(1,Math.floor(canvas.width*0.75));
   const nextHeight=Math.max(1,Math.floor(canvas.height*0.75));
   if(nextWidth===canvas.width&&nextHeight===canvas.height)break;
   // Downscale from the previous pixels without keeping an extra full-size canvas.
   const smaller=document.createElement('canvas');
   smaller.width=nextWidth;smaller.height=nextHeight;
   const smallerCtx=smaller.getContext('2d');
   if(!smallerCtx)break;
   smallerCtx.drawImage(canvas,0,0,nextWidth,nextHeight);
   canvas.width=nextWidth;canvas.height=nextHeight;
   const resizedCtx=canvas.getContext('2d');
   if(!resizedCtx)break;
   resizedCtx.drawImage(smaller,0,0);
  }
  throw new Error('Foto muito grande para o envio gratuito. Escolha outra imagem.');
 }finally{bitmap.close()}
}
export type PhotoAttempt={id:number;file:File;operation:string;base:string};
export async function uploadPhoto({id,file,operation,base}:PhotoAttempt):Promise<string>{
 const image=await preparePhoto(file);
 let message='Não foi possível confirmar a foto. Confira a imagem em Minha área.';
 try{
  const response=await fetch('/api/media-upload?listingId='+id,{method:'POST',
    headers:{'Content-Type':'image/png','X-Photo-Request':operation,'X-Previous-Photo':base},
    body:image,credentials:'same-origin',signal:AbortSignal.timeout(30000)});
  const result=await response.json();
  if(response.ok&&result.ok===true)return typeof result.warning==='string'?' '+result.warning:'';
  if(typeof result.error==='string')message=result.error;
 }catch{/* The server may have committed even if the response was lost. */}
 try{
  const state=await fetch('/api/account/listings/'+id+'/photo',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(state.ok&&(await state.json()).photoVersion===operation)return ' Foto confirmada no anúncio.';
 }catch{/* The seller can check the saved image or retry the same operation. */}
 throw new Error(message);
}
