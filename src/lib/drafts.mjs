const key='vendeplus:drafts:v1';
const categories=['Alimentação','Moda','Eletrônicos','Casa','Beleza','Serviços'];
const conditions=['Novo','Usado','Não aplicável'];
export function validDraft(value){
  return value && typeof value==='object' && typeof value.id==='string' && value.id.length<=100
    && typeof value.title==='string' && value.title.trim().length>=5 && value.title.length<=90
    && typeof value.description==='string' && value.description.trim().length>=10 && value.description.length<=2000
    && typeof value.fulfillment==='string' && value.fulfillment.trim().length>0 && value.fulfillment.length<=180
    && categories.includes(value.category) && conditions.includes(value.condition)
    && (value.priceCents===null?value.category==='Serviços':Number.isSafeInteger(value.priceCents)&&value.priceCents>0&&value.priceCents<=100000000)
    && Number.isSafeInteger(value.updatedAt) && value.updatedAt>0;
}
export function readDrafts(storage){
  try{
    const value=JSON.parse(storage.getItem(key)||'[]');
    return Array.isArray(value)?value.filter(validDraft).slice(0,50):[];
  }catch{return []}
}
export function writeDrafts(storage,drafts){
  if(drafts.length>50||!drafts.every(validDraft))throw new Error('Revise os dados do rascunho.');
  try{storage.setItem(key,JSON.stringify(drafts))}catch{throw new Error('Não foi possível salvar neste navegador. Confira o espaço e as permissões de armazenamento.')}
}
