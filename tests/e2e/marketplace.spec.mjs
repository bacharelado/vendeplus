import {test,expect} from '@playwright/test';
const items=[
  {id:101,title:'Mesa de teste',description:'Mesa usada na verificação automatizada da interface.',priceCents:15000,category:'Casa',condition:'Usado',seller:'Anunciante de teste',fulfillment:'Retirada a combinar',status:'PUBLICADO',createdAt:1},
  {id:102,title:'Serviço de teste',description:'Serviço usado na verificação automatizada da interface.',priceCents:null,category:'Serviços',condition:'Não aplicável',seller:'Anunciante de teste',fulfillment:'Atendimento a combinar',status:'PUBLICADO',createdAt:2}
];
async function catalog(page,listings=[]){await page.route('**/api/account/session',route=>route.fulfill({contentType:'application/json',body:'{"account":null}'}));await page.route('**/api/listings**',route=>{const id=new URL(route.request().url()).searchParams.get('id');return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({listings:id?listings.filter(item=>item.id===Number(id)):listings})})})}
const account={id:'00000000-0000-4000-8000-000000000001',name:'Conta de teste',email:'teste@example.invalid',neighborhood:'Poranga II',role:'seller',status:'pending',whatsapp:'5592000000000'};
async function seller(page,{signedIn=true}={}){
 let authenticated=signedIn,offers=[],sent;
 let profile={name:account.name,bio:''};
 const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 await page.route('**/api/account/session',route=>json(route,{account:authenticated?account:null}));
 await page.route('**/api/account/login',route=>{authenticated=true;return json(route,{account})});
 await page.route('**/api/account/logout',route=>{authenticated=false;return json(route,{ok:true})});
 await page.route('**/api/account/profile',route=>{if(route.request().method()==='PATCH')profile={...profile,...route.request().postDataJSON()};return json(route,{profile})});
 await page.route('**/api/account/listings',route=>{
  if(route.request().method()==='POST'){
   sent=route.request().postDataJSON();offers=[{...sent,id:123,status:'published'}];return json(route,{id:123,status:'published'},201);
  }
  return json(route,{listings:offers});
 });
 await page.route('**/api/media-upload**',route=>json(route,{available:true}));
 return {payload:()=>sent};
}
async function fillListing(page,title='Produto para teste'){
 await page.goto('/#publicar');
 await page.getByLabel('Nome do produto ou serviço',{exact:true}).fill(title);
 await page.getByLabel('Condição',{exact:true}).selectOption('Usado');
 await page.locator('input[name=price]').fill('50,00');
 await page.locator('textarea[name=description]').fill('Descrição completa usada apenas no teste automatizado.');
 await page.locator('input[name=fulfillment]').fill('Retirada a combinar');
}
const oldDraft={id:'draft-test',title:'Produto para teste',description:'Descrição do rascunho antigo.',priceCents:5000,category:'Casa',condition:'Usado',fulfillment:'Retirada a combinar',updatedAt:1};
async function seedDraft(page){
 await page.addInitScript(draft=>{if(localStorage.getItem('vendeplus:drafts:v1')===null)localStorage.setItem('vendeplus:drafts:v1',JSON.stringify([draft]))},oldDraft);
}

test('vitrine pública não contém avisos de demonstração nem anúncios inventados',async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await catalog(page);await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(page.locator('.app')).toHaveClass(/dark/);
  await expect(page.getByRole('button',{name:'Alternar tema'})).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Itacoatiara');
  await expect(page.getByRole('heading',{name:'Anúncios do bairro'})).toBeVisible();
  await expect(page.locator('.buyer-hero, .category-section, .filters')).toHaveCount(0);
  await expect(page.getByRole('searchbox',{name:'Buscar anúncios'})).toBeVisible();
  await expect(page.locator('.listing-card')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/demonstração|simulação|fictício|Vendedor de demonstração/i);
  await expect(page.getByRole('heading',{name:'Ainda não há anúncios no bairro'})).toBeVisible();
  await expect(page.locator('.demo-banner')).toHaveCount(0);
  await expect(page.locator('header a.seller-cta')).toHaveAttribute('href','#publicar');
  await expect(page.locator('main').getByRole('link',{name:'Publicar meu anúncio'})).toHaveAttribute('href','#publicar');
  await expect(page.locator('.mobile-bottom a[href="#publicar"]')).toHaveText('Anunciar');
  if(page.viewportSize()?.width>=761){
    await expect(page.locator('header a.seller-cta')).toBeVisible();
  }else{
    await expect(page.locator('.mobile-bottom').getByRole('link',{name:'Anunciar'})).toBeVisible();
  }
  await expect(page.locator('footer').getByRole('link',{name:'Minha área',exact:true})).toHaveAttribute('href','#area');
  await page.screenshot({path:info.outputPath('vitrine.png'),fullPage:true});expect(errors).toEqual([]);
});

test('indisponibilidade da API é tratada sem catálogo fictício e permite tentar novamente',async({page})=>{
  let count=0;
  await page.route('**/api/listings**',route=>{count++;return route.fulfill({status:503,contentType:'application/json',body:'{"error":"CATALOG_UNAVAILABLE"}'})});
  await page.goto('/#catalogo');
  await expect(page.getByRole('heading',{name:'Não foi possível carregar os anúncios'})).toBeVisible();
  await page.getByRole('button',{name:'Tentar novamente'}).click();
  await expect.poll(()=>count).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.listing-card')).toHaveCount(0);
});

test('catálogo usa a API e a busca direta',async({page})=>{
  await catalog(page,items);await page.goto('/#catalogo');
  await expect(page.locator('.listing-card')).toHaveCount(2);
  await expect(page.locator('.buyer-hero, .category-section, .filters')).toHaveCount(0);
  const search=page.getByRole('searchbox',{name:'Buscar anúncios'});
  await search.fill('Mesa');
  await expect(page.locator('.listing-card')).toHaveCount(1);
  await page.getByRole('button',{name:'Limpar busca'}).click();
  await expect(page.locator('.listing-card')).toHaveCount(2);
});

test('descoberta marketplace oferece categorias compactas e apenas anúncios reais',async({page})=>{
  await catalog(page,items);await page.goto('/');
  await expect(page.getByRole('heading',{name:/Tudo perto de você/})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Explore por categoria'})).toBeVisible();
  await expect(page.locator('.market-chip')).toHaveCount(7);
  await expect(page.locator('.listing-card')).toHaveCount(2);
  await expect(page.locator('.buyer-hero, .filters, .category-section')).toHaveCount(0);
  const service=page.locator('.market-chip').filter({hasText:'Serviços'});
  await service.click();
  await expect(service).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.listing-card')).toHaveCount(1);
  await expect(page.locator('.listing-card')).toContainText('Serviço de teste');
  await page.getByRole('button',{name:'Ver tudo'}).click();
  await expect(page.locator('.listing-card')).toHaveCount(2);
  await expect(service).toHaveAttribute('aria-pressed','false');
});

test('vitrine com apenas um anúncio usa convite real para anunciar',async({page})=>{
  await catalog(page,[items[0]]);await page.goto('/');
  await expect(page.locator('.listing-card')).toHaveCount(1);
  await expect(page.locator('.market-discovery-aside')).toBeAttached();
  await expect(page.locator('.market-discovery-aside a[href="#publicar"]')).toHaveCount(1);
  await expect(page.locator('.listing-card')).not.toContainText('Oferta fictícia');
});

test('anúncios usam cartão escuro e texto legível mesmo em tela grande',async({page})=>{
  await catalog(page,items);await page.goto('/');
  const card=page.locator('.listing-card').first();
  await expect(card).toBeVisible();
  await expect(card).toHaveCSS('background-color','rgb(21, 23, 28)');
  await expect(card.locator('.listing-main')).toHaveCSS('color','rgb(245, 245, 247)');
  await expect(card.locator('h3')).toHaveCSS('color','rgb(245, 245, 247)');
  await expect(card.locator('.price')).toHaveCSS('color','rgb(255, 53, 69)');
  await expect(card.locator('.listing-image')).toHaveCSS('background-color','rgb(16, 18, 22)');
});

test('busca por categoria e limpar pesquisa',async({page})=>{
  await catalog(page,items);await page.goto('/');
  const search=page.getByRole('searchbox',{name:'Buscar anúncios'});
  await search.fill('servicos');
  await expect(page.locator('.listing-card')).toHaveCount(1);
  await expect(page.locator('.listing-card')).toContainText('Serviço de teste');
  await search.fill('sem resultado');
  await expect(page.getByRole('heading',{name:'Nenhum anúncio encontrado'})).toBeVisible();
  await page.getByRole('button',{name:'Ver todos os anúncios'}).click();
  await expect(page.locator('.listing-card')).toHaveCount(2);
});

test('rascunho anterior persiste após recarregar e não vira oferta pública',async({page})=>{
 await catalog(page);await seller(page);await seedDraft(page);await page.goto('/#area');
 await expect(page.locator('.draft-card')).toContainText(oldDraft.title);
 await page.reload();await expect(page.locator('.draft-card')).toContainText(oldDraft.title);
 await expect(page.getByRole('button',{name:'Salvar rascunho',exact:true})).toHaveCount(0);
 await page.goto('/#catalogo');await expect(page.locator('.listing-card')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Ainda não há anúncios no bairro'})).toBeVisible();
});

test('rascunho anterior abre o formulário único com seus dados',async({page})=>{
 await catalog(page);await seller(page);await seedDraft(page);await page.goto('/#area');
 await page.getByRole('link',{name:'Continuar anúncio'}).click();
 await expect(page).toHaveURL(/#publicar\?rascunho=draft-test$/);
 await expect(page.getByLabel('Nome do produto ou serviço',{exact:true})).toHaveValue(oldDraft.title);
 await expect(page.locator('textarea[name=description]')).toHaveValue(oldDraft.description);
 await expect(page.locator('input[name=price]')).toHaveValue('50,00');
 await expect(page.getByLabel('Condição',{exact:true})).toHaveValue('Usado');
 await expect(page.getByRole('button',{name:'Publicar anúncio',exact:true})).toBeVisible();
});

test('exclusão de rascunho exige confirmação e persiste após recarregar',async({page})=>{
 await catalog(page);await seller(page);await seedDraft(page);await page.goto('/#area');
 page.once('dialog',dialog=>dialog.dismiss());
 await page.locator('.draft-card').getByRole('button',{name:'Excluir',exact:true}).click();
 await expect(page.locator('.draft-card')).toHaveCount(1);
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('.draft-card').getByRole('button',{name:'Excluir',exact:true}).click();
 await expect(page.locator('.draft-card')).toHaveCount(0);
 await page.reload();await expect(page.locator('.draft-card')).toHaveCount(0);
});

test('preço inválido e falha de publicação preservam o formulário sem sucesso falso',async({page})=>{
 await catalog(page);await seller(page);let requests=0;
 await page.route('**/api/account/listings',route=>{
  if(route.request().method()==='POST'){requests++;return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Não foi possível publicar agora."}'})}
  return route.fulfill({contentType:'application/json',body:'{"listings":[]}'});
 });
 await fillListing(page);
 await page.locator('input[name=price]').fill('-10');await page.getByRole('button',{name:'Publicar anúncio',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('preço válido');expect(requests).toBe(0);
 await page.locator('input[name=price]').fill('50,00');await page.getByRole('button',{name:'Publicar anúncio',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Não foi possível publicar agora');expect(requests).toBe(1);
 await expect(page.getByLabel('Nome do produto ou serviço',{exact:true})).toHaveValue('Produto para teste');
 await expect(page.getByText('Anúncio salvo.',{exact:false})).toHaveCount(0);
});

test('serviço pode ser publicado sob orçamento',async({page})=>{
 await catalog(page);const backend=await seller(page);await fillListing(page);
 await page.getByRole('combobox',{name:'Categoria',exact:true}).selectOption('Serviços');
 await page.locator('input[name=price]').fill('');await page.getByRole('button',{name:'Publicar anúncio',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Anúncio salvo.'})).toBeVisible();
 expect(backend.payload().priceCents).toBeNull();expect(backend.payload().category).toBe('Serviços');
 await page.getByRole('link',{name:'← Voltar à Minha área'}).click();
 await expect(page.locator('.account-offer')).toContainText('Sob orçamento');
});

test('detalhe mostra contato somente quando fornecido pela API e oferece cópia manual',async({page})=>{
  await catalog(page,items);await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true}));await page.goto('/#anuncio-101');
  await expect(page.getByRole('heading',{name:'Mesa de teste',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:/Conversar no WhatsApp/})).toHaveCount(0);
  await expect(page.locator('.contact-unavailable')).toBeVisible();
  await expect(page.locator('.detail-location')).toHaveText('Poranga e Jacarezinho');
  await expect(page.locator('.detail-location')).not.toContainText('Itacoatiara');
  await page.getByRole('button',{name:'Compartilhar anúncio'}).click();
  await expect(page.getByRole('textbox',{name:'Link do anúncio'})).toHaveValue(/#anuncio-101$/);
});

test('contato real fornecido gera somente um link sem envio automático',async({page})=>{
  await catalog(page,[{...items[0],contactWhatsapp:'5592000000000'}]);await page.goto('/#anuncio-101');
  const link=page.getByRole('link',{name:/Conversar no WhatsApp/});await expect(link).toHaveAttribute('href',/^https:\/\/wa.me\/5592000000000\?text=/);
  await expect(link).toHaveAttribute('rel','noopener noreferrer');
});

test('admin exige acesso e cadastro apresenta os campos reais',async({page})=>{
  await catalog(page);await page.goto('/#admin');await expect(page.getByRole('heading',{name:'Administração do site.'})).toBeVisible();
  await expect(page.getByRole('button',{name:/Aprovar|Ligar|Resolver/})).toHaveCount(0);
  await page.goto('/#cadastro');await expect(page.getByRole('heading',{name:'Crie sua conta.'})).toBeVisible();
  await expect(page.getByRole('textbox',{name:'E-mail'})).toBeVisible();
  await expect(page.getByLabel('Senha',{exact:true})).toHaveAttribute('minlength','8');
});

test('todas as páginas cabem em 320 px e na largura do perfil',async({page},info)=>{
  await catalog(page,items);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const width of [info.project.name.startsWith('mobile')?393:1280,320]){
    await page.setViewportSize({width,height:900});
    for(const route of ['inicio','catalogo','publicar','painel','anuncio-101','anuncio-999','admin','cadastro','conta','como-funciona','inexistente']){
      await page.goto('/#'+route);await expect(page.locator('main h1,main .empty-state h2').first()).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
      await page.screenshot({path:info.outputPath(`${route}-${width}.png`),fullPage:true});
    }
  }
  expect(errors).toEqual([]);
});

test('tema escuro permanente e navegação mobile funciona',async({page},info)=>{
  await catalog(page);await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(page.locator('.app')).toHaveClass(/dark/);
  await expect(page.getByRole('button',{name:'Alternar tema'})).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Itacoatiara');
  await page.screenshot({path:info.outputPath('tema-escuro.png'),fullPage:true});
  const mobile=page.getByRole('navigation',{name:'Atalhos para celular'});
  if(info.project.name.startsWith('mobile')){await expect(mobile).toBeVisible();await mobile.getByRole('link',{name:'Início e busca',exact:true}).click();await expect(page).toHaveURL(/#inicio$/)}else{await expect(mobile).toBeHidden()}
});


test('cadastro informa erro da API sem sucesso falso',async({page})=>{
 await catalog(page);await page.route('**/api/account/register',route=>route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:route.request().postDataJSON().whatsapp==='5592000000000'?'E-mail já utilizado. Entre na sua conta.':'Telefone não foi normalizado.'})}));
 await page.goto('/#cadastro');await page.getByLabel('Seu nome').fill('Conta de teste');await page.getByLabel('E-mail',{exact:true}).fill('teste@example.invalid');await page.getByLabel('Senha',{exact:true}).fill('Teste#26');await page.getByLabel('WhatsApp',{exact:true}).fill('+55 (92) 00000-0000');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Criar minha conta',exact:true}).click();await expect(page.getByRole('alert')).toContainText('E-mail já utilizado');await expect(page.getByRole('heading',{name:'Crie sua conta.'})).toBeVisible();
});

test('conta entra, publica anúncio e encerra sessão',async({page})=>{
 await catalog(page);const backend=await seller(page,{signedIn:false});
 await page.goto('/#anunciar');await expect(page).toHaveURL(/#entrar$/);
 await page.getByLabel('E-mail',{exact:true}).fill(account.email);await page.getByLabel('Senha',{exact:true}).fill('Teste#26');
 await page.getByRole('button',{name:'Entrar na minha conta',exact:true}).click();
 await expect(page).toHaveURL(/#publicar$/);
 await expect(page.getByRole('heading',{name:'Publicar anúncio.'})).toBeVisible();
 await page.getByLabel('Nome do produto ou serviço',{exact:true}).fill('Item de teste automatizado');
 await page.getByLabel('Condição',{exact:true}).selectOption('Usado');await page.locator('input[name=price]').fill('25,90');
 await page.locator('textarea[name=description]').fill('Descrição para testar o envio online.');
 await page.getByRole('button',{name:'Publicar anúncio',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Anúncio salvo.'})).toBeVisible();
 expect(backend.payload().priceCents).toBe(2590);expect(backend.payload().neighborhood).toBe('Poranga II');
 expect(backend.payload().fulfillment).toBe('Retirada ou entrega a combinar pelo WhatsApp.');
 await page.getByRole('link',{name:'← Voltar à Minha área'}).click();
 await expect(page.locator('.account-offer')).toContainText('Publicado');
 await expect(page.locator('.account-offer')).toContainText('Item de teste automatizado');
 await page.getByRole('button',{name:'Sair',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Entre na sua conta.'})).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'Entre na sua conta.'})).toBeVisible();
});

test('retorno ao catálogo atualiza ofertas retiradas no servidor',async({page})=>{
 await catalog(page);let available=true;await page.route('**/api/listings**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({listings:available?items:[]})}));
 await page.goto('/#catalogo');await expect(page.locator('.listing-card')).toHaveCount(2);await page.goto('/#conta');await expect(page.getByRole('heading',{name:'Entre na sua conta.'})).toBeVisible();available=false;await page.goto('/#catalogo');await expect(page.locator('.listing-card')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Ainda não há anúncios no bairro'})).toBeVisible();
});

test('escolher foto não chama IA nem altera os campos',async({page})=>{
 let calls=0;await catalog(page);await seller(page);
 await page.route('**/api/photo-analyze',route=>{calls++;return route.fulfill({status:503,body:'{}'})});
 await fillListing(page,'Mesa anunciada manualmente');
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGOs6IliwAaYsIoOWgkAFekBbvxvoJ4AAAAASUVORK5CYII=','base64');
 await page.getByLabel('Foto do produto (opcional)').setInputFiles({name:'produto.png',mimeType:'image/png',buffer:png});
 await expect(page.getByAltText('Foto escolhida para o anúncio')).toBeVisible();
 await expect(page.getByLabel('Nome do produto ou serviço',{exact:true})).toHaveValue('Mesa anunciada manualmente');
 await expect(page.locator('textarea[name=description]')).toHaveValue('Descrição completa usada apenas no teste automatizado.');
 expect(calls).toBe(0);
});

test('link direto abre anúncio que não estava no catálogo carregado',async({page})=>{
 await catalog(page,[]);
 await page.route('**/api/listings?id=999',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({listings:[{...items[0],id:999,title:'Anúncio antigo ainda publicado'}]})}));
 await page.goto('/#anuncio-999');
 await expect(page.getByRole('heading',{name:'Anúncio antigo ainda publicado',exact:true})).toBeVisible();
});
test('botão carrega a página seguinte sem repetir anúncios',async({page})=>{
 await catalog(page,[]);
 await page.route('**/api/listings**',route=>{const next=new URL(route.request().url()).searchParams.has('before');return route.fulfill({contentType:'application/json',body:JSON.stringify(next?{listings:[{...items[0],id:999,title:'Anúncio da próxima página'}]}:{listings:items,nextCursor:'1:1'})})});
 await page.goto('/#catalogo');await expect(page.locator('.listing-card')).toHaveCount(2);
 await page.getByRole('button',{name:'Ver mais anúncios',exact:true}).click();
 await expect(page.locator('.listing-card')).toHaveCount(3);
 await expect(page.getByRole('button',{name:'Ver mais anúncios',exact:true})).toHaveCount(0);
});

test('perfil aguarda carregamento, permite salvar e persiste após recarregar',async({page})=>{
 await catalog(page);await seller(page);let release;
 const loaded=new Promise(resolve=>{release=resolve});let profile={name:'Nome carregado',bio:''};
 await page.route('**/api/account/profile',async route=>{
  await loaded;if(route.request().method()==='PATCH')profile={...profile,...route.request().postDataJSON()};
  return route.fulfill({contentType:'application/json',body:JSON.stringify({profile})});
 });
 await page.goto('/#area');await expect(page.getByText('Carregando sua conta…',{exact:true})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Nome comercial',exact:true})).toHaveCount(0);release();
 await page.locator('.profile-settings summary').click();
 await expect(page.getByRole('textbox',{name:'Nome comercial',exact:true})).toHaveValue('Nome carregado');
 await page.getByRole('textbox',{name:'Nome comercial',exact:true}).fill('Nome atualizado no teste');
 await page.getByRole('button',{name:'Salvar perfil',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Perfil atualizado.'})).toBeVisible();
 expect(profile.name).toBe('Nome atualizado no teste');
 await page.reload();await page.locator('.profile-settings summary').click();
 await expect(page.getByRole('textbox',{name:'Nome comercial',exact:true})).toHaveValue('Nome atualizado no teste');
});

test('caminho Anunciar abre diretamente a jornada do vendedor',async({page},info)=>{
  await catalog(page);await page.goto('/');
  if(info.project.name.startsWith('mobile')){
    await page.getByRole('navigation',{name:'Atalhos para celular'}).getByRole('link',{name:'Anunciar'}).click();
  }else{
    await page.locator('header a.seller-cta').click();
  }
  await expect(page).toHaveURL(/#entrar$/);
  await expect(page.getByRole('heading',{name:'Entre na sua conta.'})).toBeVisible();
  await expect(page.getByText('Entre para publicar e gerenciar seus anúncios. Quem compra não precisa de conta.')).toBeVisible();
  expect(await page.evaluate(()=>sessionStorage.getItem('vendeplus:after-login'))).toBe('#publicar');
  await expect(page.getByRole('button',{name:'Criar conta'})).toBeVisible();
});

test('buscar eletrônicos sem menu de categorias',async({page})=>{
  await catalog(page,[{...items[0],title:'Celular do bairro',category:'Eletrônicos'}]);await page.goto('/');
  await page.getByRole('searchbox',{name:'Buscar anúncios'}).fill('eletronicos');
  await expect(page.locator('.listing-card')).toHaveCount(1);
  await expect(page.locator('.listing-card')).toContainText('Celular do bairro');
});

test('metadados do VENDE+ descrevem o projeto sem inventar ofertas',async({page})=>{
  await catalog(page);await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang','pt-BR');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://vendeplus.pages.dev/');
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content','VENDE+');
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content','pt_BR');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content',/Poranga e Jacarezinho/);
  await expect(page.locator('meta[name="description"]')).not.toHaveAttribute('content',/Itacoatiara/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#090a0d');
});

test('aba usa título verdadeiro do anúncio aberto',async({page})=>{
  await catalog(page,items);await page.goto('/#anuncio-101');
  await expect(page.getByRole('heading',{name:'Mesa de teste',exact:true})).toBeVisible();
  await expect(page).toHaveTitle('Mesa de teste | VENDE+');
});

test('denúncia revela formulário, limpa dados após sucesso e evita envio duplicado',async({page})=>{
  await catalog(page,items);
  let sent;
  await page.route('**/api/reports',route=>{sent=route.request().postDataJSON();return route.fulfill({status:201,contentType:'application/json',body:'{"ok":true}'})});
  await page.goto('/#anuncio-101');
  const button=page.getByRole('button',{name:'Denunciar este anúncio'});
  await button.click();
  await expect(page.getByRole('button',{name:'Fechar denúncia'})).toHaveAttribute('aria-expanded','true');
  await page.getByLabel('Motivo').selectOption('fraud');
  await page.getByLabel('Detalhes (opcional)').fill('Mensagem de teste sem dados pessoais.');
  await page.getByRole('button',{name:'Enviar denúncia'}).click();
  await expect(page.getByRole('status').filter({hasText:'Denúncia recebida'})).toBeVisible();
  expect(sent).toEqual({listingId:101,reason:'fraud',details:'Mensagem de teste sem dados pessoais.'});
  await button.click();
  await expect(page.getByLabel('Motivo')).toHaveValue('spam');
  await expect(page.getByLabel('Detalhes (opcional)')).toHaveValue('');
});

test('area de vendedor nao carrega catalogo publico desnecessariamente',async({page})=>{
 let requests=0;
 await page.route('**/api/account/session',route=>route.fulfill({contentType:'application/json',body:'{"account":null}'}));
 await page.route('**/api/listings**',route=>{requests++;return route.fulfill({contentType:'application/json',body:'{"listings":[]}'})});
 await page.goto('/#anunciar');
 await expect(page.getByRole('heading',{name:'Entre na sua conta.'})).toBeVisible();
 expect(requests).toBe(0);
 await page.goto('/#catalogo');
 await expect(page.getByRole('heading',{name:'Ainda não há anúncios no bairro'})).toBeVisible();
 expect(requests).toBeGreaterThan(0);
});

test('bairro e preço combinam com a busca, e limpar texto preserva o bairro',async({page})=>{
 const listings=[{...items[0],neighborhood:'Poranga I'},{...items[0],id:103,title:'Mesa mais barata',priceCents:1000,neighborhood:'Poranga I'},{...items[0],id:104,title:'Mesa de outro bairro',priceCents:500,neighborhood:'Jacarezinho'}];
 await catalog(page,listings);await page.goto('/');
 await page.getByRole('combobox',{name:'Bairro',exact:true}).selectOption('Poranga I');
 await page.getByRole('combobox',{name:'Ordenar por',exact:true}).selectOption('menor');
 await expect(page.locator('.listing-card')).toHaveCount(2);
 await expect(page.locator('.listing-card').first()).toContainText('Mesa mais barata');
 await page.getByRole('searchbox',{name:'Buscar anúncios'}).fill('sem resultado');
 await expect(page.getByRole('heading',{name:'Nenhum anúncio encontrado'})).toBeVisible();
 await expect(page.locator('.catalog-context')).toContainText('sem resultado');
 await page.getByRole('button',{name:'Limpar busca',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Bairro',exact:true})).toHaveValue('Poranga I');
 await expect(page.locator('.listing-card')).toHaveCount(2);
});

test('player externo só carrega quando solicitado',async({page})=>{
 await catalog(page);await page.route('https://drive.google.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Player de teste</title>'}));
 await page.goto('/');
 await expect(page.locator('.apocalyptic-player iframe')).toHaveCount(0);
 await page.getByRole('button',{name:'Reproduzir vídeo da APOCALYPTIC'}).click();
 await expect(page.locator('.apocalyptic-player iframe')).toHaveAttribute('src',/^https:\/\/drive.google.com\/file\/d\/.+\/preview$/);
});

test('edição salva uma vez e não reabre o formulário após atualizar a lista',async({page})=>{
 await catalog(page);await seller(page);
 let offer={...items[0],neighborhood:'Poranga II',status:'published'},writes=0;
 await page.route('**/api/account/listings',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({listings:[offer]})}));
 await page.route('**/api/account/listings/101',route=>{
  writes++;offer={...offer,...route.request().postDataJSON()};
  return route.fulfill({contentType:'application/json',body:'{"ok":true,"status":"published"}'});
 });
 await page.goto('/#publicar?anuncio=101');
 await expect(page.getByLabel('Nome do produto ou serviço',{exact:true})).toHaveValue('Mesa de teste');
 await page.getByLabel('Nome do produto ou serviço',{exact:true}).fill('Mesa atualizada no teste');
 await page.getByRole('button',{name:'Salvar alterações',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Anúncio salvo.'})).toBeVisible();
 await expect(page.locator('.seller-listing-form')).toHaveCount(0);
 expect(writes).toBe(1);
});

test('anúncio salvo continua confirmado quando só a atualização da lista falha',async({page})=>{
 await catalog(page);await seller(page);let saved=false,writes=0;
 await page.route('**/api/account/listings',route=>{
  if(route.request().method()==='POST'){saved=true;writes++;return route.fulfill({status:201,contentType:'application/json',body:'{"id":123,"status":"published"}'})}
  return route.fulfill({status:saved?503:200,contentType:'application/json',body:saved?'{"error":"Falha na lista"}':'{"listings":[]}'});
 });
 await fillListing(page);await page.getByRole('button',{name:'Publicar anúncio',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Anúncio salvo.'})).toContainText('Não foi possível atualizar sua lista');
 await expect(page.getByRole('alert')).toHaveCount(0);
 await expect(page.locator('.seller-listing-form')).toHaveCount(0);
 expect(writes).toBe(1);
});

test('foto pode ser reenviada após falha sem criar outro anúncio',async({page})=>{
 await catalog(page);await seller(page);let uploads=0,writes=0;
 await page.route('**/api/account/listings',route=>{
  if(route.request().method()==='POST'){writes++;return route.fulfill({status:201,contentType:'application/json',body:'{"id":123,"status":"published"}'})}
  return route.fulfill({contentType:'application/json',body:'{"listings":[]}'});
 });
 await page.route('**/api/media-upload?listingId=123',route=>{
  uploads++;return route.fulfill({status:uploads===1?503:200,contentType:'application/json',body:uploads===1?'{"error":"Falha temporária no envio"}':'{"ok":true}'});
 });
 await fillListing(page);
 await page.getByLabel('Foto do produto (opcional)').setInputFiles({name:'produto.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGOs6IliwAaYsIoOWgkAFekBbvxvoJ4AAAAASUVORK5CYII=','base64')});
 await page.getByRole('button',{name:'Publicar anúncio',exact:true}).click();
 await page.getByRole('button',{name:'Tentar enviar a foto novamente',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Foto salva no anúncio.'})).toBeVisible();
 expect(writes).toBe(1);expect(uploads).toBe(2);
});

test('perfil com falha permite tentar novamente e trocar de vendedor limpa dados anteriores',async({page})=>{
 await catalog(page);
 const first='00000000-0000-4000-8000-000000000001',second='00000000-0000-4000-8000-000000000002';let calls=0;
 await page.route('**/api/sellers/'+first,route=>{
  calls++;return route.fulfill({status:calls===1?503:200,contentType:'application/json',body:calls===1?'{}':JSON.stringify({seller:{id:first,name:'Primeira loja',neighborhood:'Poranga I',bio:''},listings:[]})});
 });
 await page.route('**/api/sellers/'+second,route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
 await page.goto('/#vendedor-'+first);
 await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Primeira loja',exact:true})).toBeVisible();
 await page.evaluate(hash=>{location.hash=hash},'#vendedor-'+second);
 await expect(page.getByText('Não foi possível carregar este perfil.',{exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Primeira loja',exact:true})).toHaveCount(0);
});

test('trocar o endereço entre entrar e cadastro exibe o formulário correto',async({page})=>{
 await catalog(page);await page.goto('/#entrar');
 await expect(page.getByRole('heading',{name:'Entre na sua conta.'})).toBeVisible();
 await page.evaluate(()=>{location.hash='#cadastro'});
 await expect(page.getByRole('heading',{name:'Crie sua conta.'})).toBeVisible();
 await page.evaluate(()=>{location.hash='#entrar'});
 await expect(page.getByRole('heading',{name:'Entre na sua conta.'})).toBeVisible();
});
