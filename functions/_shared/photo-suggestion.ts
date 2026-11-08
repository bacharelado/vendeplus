const validCategories=['Alimentação','Moda','Eletrônicos','Casa','Beleza','Serviços'] as const;
export type PhotoSuggestion={title:string;description:string;category:typeof validCategories[number];needsReview:true;priceCents:null};
export function photoSuggestion(result:unknown):PhotoSuggestion|null{
  const text=typeof result==='string'?result:result&&typeof result==='object'&&typeof (result as {response?:unknown}).response==='string'?(result as {response:string}).response:'';
  if(!text||text.length>6000)return null;
  const cleaned=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  let value:Record<string,unknown>;
  try{
    const parsed=JSON.parse(cleaned);
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return null;
    value=parsed;
  }catch{return null}
  if(value.uncertain===true||value.isProduct===false)return null;
  if(typeof value.title!=='string'||typeof value.description!=='string'||typeof value.category!=='string')return null;
  const title=value.title.replace(/\s+/g,' ').trim();
  const description=value.description.replace(/\s+/g,' ').trim();
  if(title.length<5||title.length>90||description.length<10||description.length>1200)return null;
  if(!validCategories.includes(value.category as typeof validCategories[number]))return null;
  return {title,description,category:value.category as typeof validCategories[number],needsReview:true,priceCents:null};
}
