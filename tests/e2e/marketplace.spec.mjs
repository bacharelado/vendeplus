import {test,expect} from '@playwright/test';
const items=[
  {id:101,title:'Mesa de teste',description:'Mesa usada na verificação automatizada da interface.',priceCents:15000,category:'Casa',condition:'Usado',seller:'Anunciante de teste',fulfillment:'Retirada a combinar',status:'PUBLICADO',createdAt:1},
  {id:102,title:'Serviço de teste',description:'Serviço usado na verificação automatizada da interface.',priceCents:null,category:'Serviços',condition:'Não aplicável',seller:'Anunciante de teste',fulfillment:'Atendimento a combinar',status:'PUBLICADO',createdAt:2}
];
async function catalog(page,listings=[]){await page.route('**/api/listings',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({listings})}))}
async function fillDraft(page,title='Produto para teste'){
  await page.goto('/#publicar');
  await page.getByRole('textbox',{name:'Título do anúncio'}).fill(title);
  await page.getByRole('textbox',{name:'Preço em reais'}).fill('50,00');
  await page.getByRole('textbox',{name:'Descrição',exact:true}).fill('Descrição completa usada apenas no teste automatizado.');
  await page.getByRole('textbox',{name:'Atendimento ou entrega'}).fill('Retirada a combinar');
}

test('vitrine pública não contém avisos de demonstração nem anúncios inventados',async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await catalog(page);await page.goto('/');
  await expect(page.getByRole('heading',{name:/O que você procura/})).toBeVisible();
  await expect(page.locator('.listing-card')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/demonstração|simulação|fictício|Vendedor de demonstração/i);
  await expect(page.getByRole('heading',{name:'O bairro tem muito a oferecer'})).toBeVisible();
  await expect(page.locator('.demo-banner')).toHaveCount(0);
  await page.screenshot({path:info.outputPath('vitrine.png'),fullPage:true});expect(errors).toEqual([]);
});

test('indisponibilidade da API é tratada sem catálogo fictício e permite tentar novamente',async({page})=>{
  let count=0;
  await page.route('**/api/listings',route=>{count++;return route.fulfill({status:503,contentType:'application/json',body:'{"error":"CATALOG_UNAVAILABLE"}'})});
  await page.goto('/#catalogo');
  await expect(page.getByRole('heading',{name:'Ofertas em preparação'})).toBeVisible();
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
  await expect(page.getByRole('heading',{name:'O bairro tem muito a oferecer'})).toBeVisible();
});

test('rascunho pode ser editado e atualização é salva',async({page})=>{
  await catalog(page);await fillDraft(page);
  await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();
  await page.getByRole('link',{name:'Editar',exact:true}).click();
  await page.getByRole('textbox',{name:'Título do anúncio'}).fill('Produto atualizado no teste');
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
  await page.getByRole('textbox',{name:'Título do anúncio'}).fill('Produto para teste');
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

test('admin não oferece controles públicos e cadastro não finge criar conta',async({page})=>{
  await catalog(page);await page.goto('/#admin');await expect(page.getByRole('heading',{name:'Área restrita'})).toBeVisible();
  await expect(page.getByRole('button',{name:/Aprovar|Ligar|Resolver/})).toHaveCount(0);
  await page.goto('/#cadastro');await expect(page.getByRole('heading',{name:'Meus rascunhos.'})).toBeVisible();
  await expect(page.getByRole('textbox',{name:'E-mail'})).toHaveCount(0);
});

test('todas as páginas cabem em 320 px e na largura do perfil',async({page},info)=>{
  await catalog(page,items);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const width of [info.project.name.startsWith('mobile')?393:1280,320]){
    await page.setViewportSize({width,height:900});
    for(const route of ['inicio','catalogo','publicar','painel','anuncio-101','anuncio-999','admin','como-funciona','inexistente']){
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
