import {test,expect} from '@playwright/test';
const items=[
  {id:101,title:'Mesa de teste',description:'Mesa usada na verificação automatizada da interface.',priceCents:15000,category:'Casa',condition:'Usado',seller:'Anunciante de teste',fulfillment:'Retirada a combinar',status:'PUBLICADO',createdAt:1},
  {id:102,title:'Serviço de teste',description:'Serviço usado na verificação automatizada da interface.',priceCents:null,category:'Serviços',condition:'Não aplicável',seller:'Anunciante de teste',fulfillment:'Atendimento a combinar',status:'PUBLICADO',createdAt:2}
];
async function catalog(page,listings=[]){await page.route('**/api/account/session',route=>route.fulfill({contentType:'application/json',body:'{"account":null}'}));await page.route('**/api/listings**',route=>{const id=new URL(route.request().url()).searchParams.get('id');return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({listings:id?listings.filter(item=>item.id===Number(id)):listings})})})}
async function fillDraft(page,title='Produto para teste'){
  await page.goto('/#publicar');
  await page.getByRole('textbox',{name:'O que você está vendendo?'}).fill(title);
  await page.getByRole('textbox',{name:'Preço em reais'}).fill('50,00');
  await page.getByRole('textbox',{name:'Conte sobre o produto',exact:true}).fill('Descrição completa usada apenas no teste automatizado.');
  await page.getByRole('textbox',{name:'Como será a entrega?'}).fill('Retirada a combinar');
}

test('vitrine pública não contém avisos de demonstração nem anúncios inventados',async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await catalog(page);await page.goto('/');
  await expect(page.getByRole('heading',{name:/Encontre o que você precisa/})).toBeVisible();
  await expect(page.locator('.listing-card')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/demonstração|simulação|fictício|Vendedor de demonstração/i);
  await expect(page.getByRole('heading',{name:'Ainda não há anúncios no bairro'})).toBeVisible();
  await expect(page.locator('.demo-banner')).toHaveCount(0);
  await expect(page.locator('header a.seller-cta')).toHaveAttribute('href','#anunciar');
  await expect(page.locator('main').getByRole('link',{name:'Publicar meu anúncio'})).toHaveAttribute('href','#anunciar');
  await expect(page.locator('.mobile-bottom a[href="#anunciar"]')).toHaveText('Anunciar');
  if(page.viewportSize()?.width>=761){
    await expect(page.locator('header a.seller-cta')).toBeVisible();
  }else{
    await expect(page.locator('.mobile-bottom').getByRole('link',{name:'Anunciar'})).toBeVisible();
  }
  await expect(page.locator('footer').getByRole('link',{name:'Área de quem anuncia',exact:true})).toHaveAttribute('href','#conta');
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

test('catálogo usa a API, busca, categoria e ordenação',async({page})=>{
  await catalog(page,items);await page.goto('/#catalogo');
  await expect(page.locator('.listing-card')).toHaveCount(2);
  await page.getByRole('textbox',{name:'Buscar anúncios'}).fill('  MESA ');
  await expect(page.locator('.listing-card')).toHaveCount(1);
  await page.getByRole('button',{name:'Limpar filtros'}).click();
  await page.getByRole('combobox',{name:'Ordenação'}).selectOption('menor');
  await expect(page.locator('.listing-card').first()).toContainText('Mesa de teste');
  await page.locator('.catalog-sidebar').getByRole('button',{name:'Serviços',exact:true}).click();
  await expect(page.locator('.listing-card')).toHaveCount(1);
  await expect(page.locator('.listing-card')).toContainText('Sob orçamento');
});

test('busca inicial e categorias abrem o catálogo filtrado',async({page})=>{
  await catalog(page,items);await page.goto('/');
  await page.getByRole('textbox',{name:'Pesquisar no bairro'}).fill('Mesa');
  await page.getByRole('button',{name:'Buscar',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Buscar anúncios'})).toHaveValue('Mesa');
  await expect(page.locator('.listing-card')).toHaveCount(1);
  await page.getByRole('link',{name:'VENDE+ início'}).click();
  await page.locator('.category-grid').getByRole('button',{name:'Serviços',exact:true}).click();
  await expect(page.locator('.listing-card')).toHaveCount(1);
  await expect(page.locator('.listing-card')).toContainText('Serviço de teste');
});

test('rascunho persiste após recarregar e não vira oferta pública',async({page})=>{
  await catalog(page);await fillDraft(page);
  await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();
  await expect(page).toHaveURL(/#painel$/);
  await expect(page.locator('.draft-card')).toContainText('Produto para teste');
  await page.reload();await expect(page.locator('.draft-card')).toContainText('Produto para teste');
  await page.goto('/#catalogo');await expect(page.locator('.listing-card')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Ainda não há anúncios no bairro'})).toBeVisible();
});

test('rascunho pode ser editado e atualização é salva',async({page})=>{
  await catalog(page);await fillDraft(page);
  await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();
  await page.getByRole('link',{name:'Editar',exact:true}).click();
  await page.getByRole('textbox',{name:'O que você está vendendo?'}).fill('Produto atualizado no teste');
  await page.getByRole('button',{name:'Salvar alterações',exact:true}).click();
  await page.reload();await expect(page.locator('.draft-card')).toContainText('Produto atualizado no teste');
  await expect(page.locator('.draft-card')).toHaveCount(1);
});

test('exclusão pede confirmação, modal controla foco e não reaparece após recarregar',async({page},info)=>{
  await catalog(page);await fillDraft(page);await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();
  const trigger=page.getByRole('button',{name:'Excluir rascunho: Produto para teste'});
  await trigger.click();const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('button',{name:'Fechar',exact:true})).toBeFocused();
  await page.keyboard.press('Shift+Tab');await expect(dialog.getByRole('button',{name:'Excluir rascunho',exact:true})).toBeFocused();
  await page.keyboard.press('Tab');await expect(dialog.getByRole('button',{name:'Fechar',exact:true})).toBeFocused();
  await page.screenshot({path:info.outputPath('confirmacao.png'),fullPage:true});
  await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
  await expect(page.locator('.draft-card')).toHaveCount(1);await trigger.click();
  await dialog.getByRole('button',{name:'Excluir rascunho',exact:true}).click();
  await expect(page.locator('.draft-card')).toHaveCount(0);await page.reload();await expect(page.locator('.draft-card')).toHaveCount(0);
});

test('espaços vazios, preço inválido e falha de armazenamento não produzem sucesso falso',async({page})=>{
  await catalog(page);await fillDraft(page,'     ');await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Espaços em branco não contam');
  await page.getByRole('textbox',{name:'O que você está vendendo?'}).fill('Produto para teste');
  await page.getByRole('textbox',{name:'Preço em reais'}).fill('-10');await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('preço válido');
  await page.getByRole('textbox',{name:'Preço em reais'}).fill('50,00');
  await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new Error('quota')}});
  await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível salvar');
  await expect(page).toHaveURL(/#publicar$/);
});

test('serviço pode ficar sob orçamento',async({page})=>{
  await catalog(page);await fillDraft(page);
  await page.getByRole('combobox',{name:'Categoria',exact:true}).selectOption('Serviços');
  await page.getByRole('textbox',{name:'Preço em reais'}).fill('');await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();
  await expect(page.locator('.draft-card')).toContainText('Sob orçamento');
});

test('detalhe mostra contato somente quando fornecido pela API e oferece cópia manual',async({page})=>{
  await catalog(page,items);await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true}));await page.goto('/#anuncio-101');
  await expect(page.getByRole('heading',{name:'Mesa de teste',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:/Conversar no WhatsApp/})).toHaveCount(0);
  await expect(page.locator('.contact-unavailable')).toBeVisible();
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

test('tema persiste e navegação mobile funciona',async({page},info)=>{
  await catalog(page);await page.goto('/');await page.getByRole('button',{name:'Alternar tema'}).click();await page.reload();await expect(page.locator('.app')).toHaveClass(/dark/);
  await page.screenshot({path:info.outputPath('tema-escuro.png'),fullPage:true});
  const mobile=page.getByRole('navigation',{name:'Atalhos para celular'});
  if(info.project.name.startsWith('mobile')){await expect(mobile).toBeVisible();await mobile.getByRole('link',{name:'Buscar',exact:true}).click();await expect(page).toHaveURL(/#catalogo$/)}else{await expect(mobile).toBeHidden()}
});


test('cadastro informa erro da API sem sucesso falso',async({page})=>{
 await catalog(page);await page.route('**/api/account/register',route=>route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:route.request().postDataJSON().whatsapp==='5592000000000'?'E-mail já utilizado. Entre na sua conta.':'Telefone não foi normalizado.'})}));
 await page.goto('/#cadastro');await page.getByLabel('Seu nome').fill('Conta de teste');await page.getByLabel('E-mail',{exact:true}).fill('teste@example.invalid');await page.getByLabel('Senha',{exact:true}).fill('Teste#26');await page.getByLabel('WhatsApp',{exact:true}).fill('+55 (92) 00000-0000');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Criar conta',exact:true}).click();await expect(page.getByRole('alert')).toContainText('E-mail já utilizado');await expect(page.getByRole('heading',{name:'Crie sua conta.'})).toBeVisible();
});

test('conta publica anúncio e encerra sessão',async({page})=>{
 await catalog(page);const account={id:'teste',name:'Conta de teste',email:'teste@example.invalid',neighborhood:'Poranga II',role:'seller',status:'pending'};let offers=[];let sent;
 await page.route('**/api/account/login',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({account})}));
 await page.route('**/api/account/listings',async route=>{if(route.request().method()==='POST'){sent=route.request().postDataJSON();offers=[{...sent,id:123,status:'published'}];return route.fulfill({status:201,contentType:'application/json',body:'{"id":123,"status":"published"}'})}return route.fulfill({contentType:'application/json',body:JSON.stringify({listings:offers})})});
 await page.route('**/api/account/profile',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({profile:{name:account.name,bio:''}})}));
 await page.route('**/api/account/logout',route=>route.fulfill({contentType:'application/json',body:'{"ok":true}'}));
 await page.goto('/#anunciar');await page.getByLabel('E-mail',{exact:true}).fill('teste@example.invalid');await page.getByLabel('Senha',{exact:true}).fill('Teste#26');await page.getByRole('button',{name:'Entrar',exact:true}).click();await expect(page.getByRole('heading',{name:'Meus anúncios.'})).toBeVisible();
 await page.getByLabel('O que você está vendendo?',{exact:true}).fill('Item de teste automatizado');await page.getByLabel('Condição',{exact:true}).selectOption('Usado');await page.getByLabel('Preço em reais').fill('25,90');await page.getByLabel('Conte sobre o produto',{exact:true}).fill('Descrição para testar o envio online.');await page.getByLabel('Como será a entrega?').fill('Retirada a combinar');await page.getByRole('button',{name:'Publicar anúncio',exact:true}).click();await expect(page.locator('.account-offer')).toContainText('Publicado');expect(sent.priceCents).toBe(2590);expect(sent.neighborhood).toBe('Poranga II');await expect(page.locator('.listing-card')).toHaveCount(0);
 await page.getByRole('button',{name:'Sair',exact:true}).click();await expect(page.getByRole('heading',{name:'Entre na sua conta.'})).toBeVisible();
});


test('retorno ao catálogo atualiza ofertas retiradas no servidor',async({page})=>{
 await catalog(page);let available=true;await page.route('**/api/listings**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({listings:available?items:[]})}));
 await page.goto('/#catalogo');await expect(page.locator('.listing-card')).toHaveCount(2);await page.goto('/#conta');await expect(page.getByRole('heading',{name:'Entre na sua conta.'})).toBeVisible();available=false;await page.goto('/#catalogo');await expect(page.locator('.listing-card')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Ainda não há anúncios no bairro'})).toBeVisible();
});

test('escolher foto não chama IA nem altera os campos',async({page})=>{
 let calls=0;await catalog(page);
 await page.route('**/api/photo-analyze',route=>{calls++;return route.fulfill({status:503,body:'{}'})});
 await fillDraft(page,'Mesa anunciada manualmente');
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGOs6IliwAaYsIoOWgkAFekBbvxvoJ4AAAAASUVORK5CYII=','base64');
 await page.getByLabel('Foto do produto (opcional)').setInputFiles({name:'produto.png',mimeType:'image/png',buffer:png});
 await expect(page.getByAltText('Foto escolhida para o anúncio')).toBeVisible();
 await expect(page.getByRole('textbox',{name:'O que você está vendendo?'})).toHaveValue('Mesa anunciada manualmente');
 await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();
 await expect(page).toHaveURL(/#painel$/);expect(calls).toBe(0);
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

test('perfil só fica editável após carregar e não perde texto ao publicar anúncio',async({page})=>{
 await catalog(page);
 const account={id:'teste',name:'Conta de teste',email:'teste@example.invalid',neighborhood:'Poranga II',role:'seller',status:'pending'};
 let release;const loaded=new Promise(resolve=>{release=resolve});
 await page.route('**/api/account/session',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({account})}));
 await page.route('**/api/account/listings',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(route.request().method()==='POST'?{id:123,status:'published'}:{listings:[]})}));
 await page.route('**/api/account/profile',async route=>{await loaded;return route.fulfill({contentType:'application/json',body:JSON.stringify({profile:{name:'Nome carregado',bio:''}})})});
 await page.goto('/#anunciar');
 await expect(page.getByText('Carregando sua conta…',{exact:true})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Nome comercial',exact:true})).toHaveCount(0);
 release();
 await expect(page.getByRole('textbox',{name:'Nome comercial',exact:true})).toHaveValue('Nome carregado');
 await page.getByRole('textbox',{name:'Nome comercial',exact:true}).fill('Nome novo ainda não salvo');
 await page.getByRole('textbox',{name:'O que você está vendendo?',exact:true}).fill('Mesa para testar carregamento');await page.getByLabel('Condição',{exact:true}).selectOption('Usado');
 await page.getByRole('textbox',{name:'Preço em reais'}).fill('50,00');
 await page.getByRole('textbox',{name:'Conte sobre o produto',exact:true}).fill('Mesa usada com quatro lugares.');
 await page.getByRole('textbox',{name:'Como será a entrega?'}).fill('Retirada no bairro');
 await page.getByRole('button',{name:'Publicar anúncio',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Anúncio salvo.'})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Nome comercial',exact:true})).toHaveValue('Nome novo ainda não salvo');
});


test('caminho Anunciar abre diretamente a jornada do vendedor',async({page},info)=>{
  await catalog(page);await page.goto('/');
  if(info.project.name.startsWith('mobile')){
    await page.getByRole('navigation',{name:'Atalhos para celular'}).getByRole('link',{name:'Anunciar'}).click();
  }else{
    await page.locator('header a.seller-cta').click();
  }
  await expect(page).toHaveURL(/#anunciar$/);
  await expect(page.getByRole('heading',{name:'Entre na sua conta.'})).toBeVisible();
  await expect(page.getByText('Entre ou crie sua conta')).toBeVisible();
  await expect(page.getByRole('button',{name:'Criar conta'})).toBeVisible();
});

test('pesquisa rápida de eletrônicos abre catálogo filtrado',async({page})=>{
  await catalog(page,items);await page.goto('/');
  await page.getByRole('button',{name:'📱 Eletrônicos'}).click();
  await expect(page).toHaveURL(/#catalogo$/);
  await expect(page.locator('.filter-feedback')).toContainText('Eletrônicos');
});


test('metadados do VENDE+ descrevem o projeto sem inventar ofertas',async({page})=>{
  await catalog(page);await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang','pt-BR');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://vendeplus.pages.dev/');
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content','VENDE+');
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content','pt_BR');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content',/Poranga e Jacarezinho/);
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
