export type ListingStatus = 'PUBLICADO' | 'EM_ANALISE' | 'PAUSADO' | 'VENDIDO' | 'BLOQUEADO' | 'REMOVIDO';
export type Category = 'Alimentação' | 'Moda' | 'Eletrônicos' | 'Casa' | 'Beleza' | 'Serviços';
export type Listing = {
  id: number;
  title: string;
  description: string;
  priceCents: number | null;
  category: Category;
  condition: 'Novo' | 'Usado' | 'Não aplicável';
  seller: string;
  emoji: string;
  image?: string; // Foto ilustrativa usada somente na demonstracao
  fulfillment: string;
  status: ListingStatus;
  owner: boolean;
  views: number;
  contacts: number;
};

export const categories: {name: Category, emoji: string}[] = [
  {name: 'Alimentação', emoji: '🍱'}, {name: 'Moda', emoji: '👕'},
  {name: 'Eletrônicos', emoji: '📱'}, {name: 'Casa', emoji: '🛋️'},
  {name: 'Beleza', emoji: '✂️'}, {name: 'Serviços', emoji: '🛠️'}
];

export const initialListings: Listing[] = [
  {id:1,title:'Marmita caseira',description:'Arroz, feijão, proteína e salada. Encomendas para o almoço.',priceCents:1800,category:'Alimentação',condition:'Novo',seller:'Cozinha da Marta',emoji:'🍱',image:'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1000&q=78',fulfillment:'Retirada ou entrega combinada',status:'PUBLICADO',owner:true,views:94,contacts:20},
  {id:2,title:'Bolo de pote 200 ml',description:'Bolo de pote fresquinho nos sabores chocolate e ninho.',priceCents:1200,category:'Alimentação',condition:'Novo',seller:'Cozinha da Marta',emoji:'🍰',image:'https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?auto=format&fit=crop&w=1000&q=78',fulfillment:'Retirada no Poranga II',status:'PUBLICADO',owner:true,views:123,contacts:18},
  {id:3,title:'Galaxy A12 usado',description:'Funcionando bem, com carregador. Confira antes de comprar.',priceCents:45000,category:'Eletrônicos',condition:'Usado',seller:'Carlos T.',emoji:'📱',image:'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1000&q=78',fulfillment:'Entrega em local público',status:'PUBLICADO',owner:false,views:210,contacts:31},
  {id:4,title:'Sofá de 3 lugares',description:'Sofá retrátil cinza, com pouco uso.',priceCents:85000,category:'Casa',condition:'Usado',seller:'Joana R.',emoji:'🛋️',image:'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1000&q=78',fulfillment:'Retirada por conta do comprador',status:'PUBLICADO',owner:false,views:61,contacts:8},
  {id:5,title:'Corte de cabelo',description:'Corte masculino e barba com agendamento.',priceCents:3000,category:'Beleza',condition:'Não aplicável',seller:'Studio do Beto',emoji:'💈',image:'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=1000&q=78',fulfillment:'Atendimento a combinar',status:'PUBLICADO',owner:false,views:98,contacts:22},
  {id:6,title:'Conserto de celular',description:'Troca de tela e diagnóstico por orçamento.',priceCents:null,category:'Serviços',condition:'Não aplicável',seller:'Assistência Local',emoji:'🔧',image:'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=78',fulfillment:'Atendimento no bairro',status:'PUBLICADO',owner:false,views:72,contacts:13},
  {id:7,title:'Salgados para festa',description:'Cento de salgados para eventos, sob encomenda.',priceCents:3500,category:'Alimentação',condition:'Novo',seller:'Cozinha da Marta',emoji:'🥟',image:'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1000&q=78',fulfillment:'Retirada combinada',status:'EM_ANALISE',owner:true,views:0,contacts:0},
  {id:8,title:'Camisa casual preta',description:'Camisa tamanho M, em bom estado.',priceCents:3500,category:'Moda',condition:'Usado',seller:'Luana S.',emoji:'👕',image:'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1000&q=78',fulfillment:'Retirada no bairro',status:'PUBLICADO',owner:false,views:40,contacts:7}
];
