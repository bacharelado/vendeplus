export const categories = [
  {name:'Alimentação',emoji:'🍱'},
  {name:'Moda',emoji:'👕'},
  {name:'Eletrônicos',emoji:'📱'},
  {name:'Casa',emoji:'🛋️'},
  {name:'Beleza',emoji:'✂️'},
  {name:'Serviços',emoji:'🛠️'}
] as const;

export type Category = typeof categories[number]['name'];
export type Condition = 'Novo'|'Usado'|'Não aplicável';
export type Listing = {
  id:number;
  title:string;
  description:string;
  priceCents:number|null;
  category:Category;
  condition:Condition;
  seller:string;
  image?:string;
  fulfillment:string;
  contactWhatsapp?:string;
  status:'PUBLICADO';
  createdAt:number;
};
export type Draft = {
  id:string;
  title:string;
  description:string;
  priceCents:number|null;
  category:Category;
  condition:Condition;
  fulfillment:string;
  updatedAt:number;
};
