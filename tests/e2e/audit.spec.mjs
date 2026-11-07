import {test, expect} from '@playwright/test';

async function publish(page, {title='Produto fictício de auditoria', description='Descrição fictícia para auditar publicação.', price='50,00', category='Casa', fulfillment='Retirada fictícia'}={}) {
  await page.locator('.demo-banner').getByRole('link', {name:'Vendedor', exact:true}).click();
  await page.getByRole('link', {name:'+ Anunciar', exact:true}).click();
  await page.getByRole('textbox', {name:'Título', exact:true}).fill(title);
  await page.getByRole('combobox', {name:'Categoria', exact:true}).selectOption(category);
  await page.getByRole('textbox', {name:'Preço em reais'}).fill(price);
  await page.getByRole('textbox', {name:'Descrição', exact:true}).fill(description);
  await page.getByRole('textbox', {name:'Atendimento ou entrega'}).fill(fulfillment);
  await page.getByRole('button', {name:'Publicar (simulação)', exact:true}).click();
}

function contrast(rgb1, rgb2) {
  const luminance = value => {
    const rgb = value.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
    return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
  };
  const a=luminance(rgb1), b=luminance(rgb2);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}

test('modal mantém foco, bloqueia fundo, fecha com Escape e devolve foco', async ({page},testInfo)=>{
  await page.goto('/#anuncio-3');
  const trigger=page.getByRole('button',{name:/Testar contato/});
  await trigger.click();
  const modal=page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button',{name:'Fechar',exact:true})).toBeFocused();
  await page.keyboard.press('Tab');
  await expect.poll(()=>page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement))).toBe(true);
  await expect(page.getByRole('navigation',{name:'Menu principal'}).getByRole('link',{name:'Início',exact:true}).click({trial:true,timeout:800})).rejects.toThrow();
  await page.screenshot({path:testInfo.outputPath('modal.png'),fullPage:true});
  await page.keyboard.press('Escape');
  await expect(modal).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('temas claro e escuro mantêm contraste nos textos verificados',async({page},testInfo)=>{
  await page.goto('/#anuncio-1');
  for(const selector of ['.back','.muted']){
    const color=await page.locator(selector).first().evaluate(el=>getComputedStyle(el).color);
    expect(contrast(color,'rgb(242, 246, 249)')).toBeGreaterThanOrEqual(4.5);
  }
  await page.getByRole('button',{name:'Alternar tema'}).click();
  for(const selector of ['.tip','.pill']){
    const colors=await page.locator(selector).first().evaluate(el=>{const s=getComputedStyle(el);return [s.color,s.backgroundColor]});
    expect(contrast(...colors)).toBeGreaterThanOrEqual(4.5);
  }
  await page.screenshot({path:testInfo.outputPath('tema-escuro.png'),fullPage:true});
});

test('todos os destinos cabem em 320px, celular e computador sem erros',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const widths=[testInfo.project.name.startsWith('mobile')?393:1280,320];
  for(const width of widths){
    await page.setViewportSize({width,height:900});
    for(const route of ['inicio','catalogo','anuncio-3','cadastro','painel','publicar','admin','anuncio-999']){
      await page.goto('/#'+route);
      await expect(page.locator('main h1')).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
      await page.screenshot({path:testInfo.outputPath(`${route}-${width}.png`),fullPage:true});
    }
  }
  expect(errors).toEqual([]);
});

test('rejeita publicação só com espaços e mantém preenchimento para correção',async({page})=>{
  await page.goto('/#inicio');
  await publish(page,{title:'     ',description:'          ',fulfillment:' '});
  await expect(page.getByRole('dialog')).toContainText('Revise os campos');
  await page.getByRole('button',{name:'Fechar',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Título',exact:true})).toHaveValue('     ');
});

test('valida preço, serviço sob orçamento e conteúdo bloqueado',async({page})=>{
  await page.goto('/#inicio');
  await publish(page,{price:'-10'});
  await expect(page.getByRole('dialog')).toContainText('Preço inválido');
  await page.getByRole('button',{name:'Fechar',exact:true}).click();
  await page.getByRole('textbox',{name:'Preço em reais'}).fill('');
  await page.getByRole('combobox',{name:'Categoria',exact:true}).selectOption('Serviços');
  await page.getByRole('button',{name:'Publicar (simulação)',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('PUBLICADO');
  await page.getByRole('link',{name:'Ir ao painel'}).click();
  await publish(page,{title:'Vape fictício proibido'});
  await expect(page.getByRole('dialog')).toContainText('BLOQUEADO');
  await page.getByRole('link',{name:'Ir ao painel'}).click();
  await page.getByRole('link',{name:'← Site público'}).click();
  await page.locator('.hero-actions').getByRole('link',{name:/Explorar ofertas/}).click();
  await page.getByRole('textbox',{name:'Buscar anúncios'}).fill('Vape fictício');
  await expect(page.locator('.listing-card')).toHaveCount(0);
});

test('anúncio temporário não promete link compartilhável e aparece nas novidades',async({page})=>{
  await page.goto('/#inicio');
  await publish(page);
  await page.getByRole('link',{name:'Ir ao painel'}).click();
  await page.getByRole('link',{name:'← Site público'}).click();
  await expect(page.locator('.listing-card').first()).toContainText('Produto fictício de auditoria');
  await page.locator('.listing-card').first().click();
  await page.getByRole('button',{name:/Compartilhar/}).click();
  await expect(page.getByRole('dialog')).toContainText('Anúncio temporário');
  await expect(page.getByRole('dialog').getByRole('textbox')).toHaveCount(0);
});

test('pausar, reativar e marcar vendido atualizam catálogo e detalhe',async({page})=>{
  await page.goto('/#painel');
  const listing=page.locator('.listing-line').filter({hasText:'Marmita caseira'});
  await listing.getByRole('button',{name:'Pausar',exact:true}).click();
  await expect(listing).toContainText('PAUSADO');
  await page.getByRole('link',{name:'← Site público'}).click();
  await page.locator('.hero-actions').getByRole('link',{name:/Explorar ofertas/}).click();
  await expect(page.getByRole('link',{name:'Ver anúncio: Marmita caseira',exact:true})).toHaveCount(0);
  await page.locator('.demo-banner').getByRole('link',{name:'Vendedor',exact:true}).click();
  await listing.getByRole('button',{name:'Reativar',exact:true}).click();
  await expect(listing).toContainText('PUBLICADO');
  await listing.getByRole('button',{name:'Vendido',exact:true}).click();
  await expect(listing).toContainText('VENDIDO');
  await page.getByRole('link',{name:'← Site público'}).click();
  await expect(page.getByRole('link',{name:'Ver anúncio: Marmita caseira',exact:true})).toHaveCount(0);
});

test('admin aprova e rejeita retidos, retira denunciado e resolve denúncia',async({page})=>{
  await page.goto('/#admin');
  const review=page.locator('.listing-line').filter({hasText:'Salgados para festa'});
  await review.getByRole('button',{name:'Aprovar (simulação)',exact:true}).click();
  await expect(review).toHaveCount(0);
  await page.getByRole('link',{name:'Visitante',exact:true}).click();
  await page.getByRole('link',{name:'Ver anúncio: Salgados para festa',exact:true}).click();
  await page.getByRole('button',{name:/Denunciar/}).click();
  await page.getByRole('button',{name:/Enviar denúncia/}).click();
  await page.getByRole('link',{name:/Ver moderação/}).click();
  await page.getByRole('button',{name:'Retirar anúncio (simulação)',exact:true}).click();
  await page.getByRole('button',{name:'Resolver',exact:true}).click();
  await expect(page.getByRole('button',{name:'Resolver',exact:true})).toHaveCount(0);
  await expect(page.locator('.stack')).toContainText('resolvida');
  await page.getByRole('link',{name:'Visitante',exact:true}).click();
  await publish(page,{description:'Produto fictício com pagamento antecipado para revisão.'});
  await expect(page.getByRole('dialog')).toContainText('EM ANALISE');
  await page.getByRole('link',{name:'Ir ao painel'}).click();
  await page.getByRole('link',{name:'Administrador',exact:true}).click();
  await page.getByRole('button',{name:'Rejeitar (simulação)',exact:true}).click();
  await expect(page.getByRole('button',{name:'Aprovar (simulação)',exact:true})).toHaveCount(0);
});

test('bloqueio emergencial impede nova publicação',async({page})=>{
  await page.goto('/#admin');
  await page.getByRole('button',{name:'Ligar',exact:true}).click();
  await publish(page);
  await expect(page.getByRole('dialog')).toContainText('Publicações suspensas');
});

test('clipboard indisponível oferece cópia manual do exemplo inicial',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true}));
  await page.goto('/#anuncio-3');
  await page.getByRole('button',{name:/Compartilhar/}).click();
  await expect(page.getByRole('dialog')).toContainText('Copie este link');
  await expect(page.getByRole('textbox',{name:'Link do anúncio'})).toHaveValue(/#anuncio-3$/);
});


test('aprovação administrativa continua válida após pausar e reativar',async({page})=>{
  await page.goto('/#inicio');
  await publish(page,{description:'Produto fictício com pagamento antecipado para revisão.'});
  await page.getByRole('link',{name:'Ir ao painel'}).click();
  await page.getByRole('link',{name:'Administrador',exact:true}).click();
  const review=page.locator('.listing-line').filter({hasText:'Produto fictício de auditoria'});
  await review.getByRole('button',{name:'Aprovar (simulação)',exact:true}).click();
  await page.locator('.demo-banner').getByRole('link',{name:'Vendedor',exact:true}).click();
  const own=page.locator('.listing-line').filter({hasText:'Produto fictício de auditoria'});
  await own.getByRole('button',{name:'Pausar',exact:true}).click();
  await expect(own).toContainText('PAUSADO');
  await own.getByRole('button',{name:'Reativar',exact:true}).click();
  await expect(own).toContainText('PUBLICADO');
});
