import {test, expect} from '@playwright/test';

test('início abre sem erro de JavaScript e permite visualizar a vitrine', async ({page}, testInfo) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('/#inicio');
  await expect(page.getByRole('heading', {name: /Seu bairro tem de tudo/i})).toBeVisible();
  await expect(page.locator('.listing-card')).toHaveCount(4);
  await expect(page.locator('.hero-actions').getByRole('link', {name: /Explorar ofertas/})).toBeVisible();
  await page.screenshot({path: testInfo.outputPath('inicio.png'), fullPage: true, animations: 'disabled'});
  expect(errors).toEqual([]);
});

test('busca, filtros e limpeza funcionam no catálogo', async ({page}, testInfo) => {
  await page.goto('/#catalogo');
  await expect(page.getByRole('heading', {name: 'Catálogo'})).toBeVisible();
  await expect(page.locator('.listing-card')).toHaveCount(7);
  await page.getByRole('textbox', {name: 'Buscar anúncios'}).fill('  MARmita  ');
  await expect(page.locator('.listing-card')).toHaveCount(1);
  await expect(page.locator('.listing-card').first()).toContainText('Marmita caseira');
  await page.getByRole('button', {name: 'Limpar filtros'}).click();
  await expect(page.locator('.listing-card')).toHaveCount(7);
  await page.locator('.chips').getByRole('button', {name: 'Eletrônicos'}).click();
  await expect(page.locator('.listing-card')).toHaveCount(1);
  await expect(page.locator('.listing-card')).toContainText('Galaxy A12');
  await page.getByRole('button', {name: 'Limpar filtros'}).click();
  await page.getByRole('combobox', {name: 'Ordenação'}).selectOption('menor');
  await expect(page.locator('.listing-card').first()).toContainText('Bolo de pote');
  await page.screenshot({path: testInfo.outputPath('catalogo.png'), fullPage: true, animations: 'disabled'});
});

test('detalhe do anúncio, WhatsApp demonstrativo, compartilhamento e denúncia', async ({page}, testInfo) => {
  await page.goto('/#anuncio-3');
  await expect(page.getByRole('heading', {name: 'Galaxy A12 usado'})).toBeVisible();
  await expect(page.locator('.detail-image')).toBeVisible();
  await page.getByRole('button', {name: /Testar contato via WhatsApp/}).click();
  await expect(page.getByRole('dialog')).toContainText('Não há contatos reais');
  await page.getByRole('button', {name: 'Fechar'}).click();

  await page.getByRole('button', {name: /Compartilhar/}).click();
  await expect(page.getByRole('dialog').getByRole('textbox', {name: 'Link do anúncio'})).toHaveValue(/#anuncio-3$/);
  await page.getByRole('button', {name: 'Fechar'}).click();

  await page.getByRole('button', {name: /Denunciar/}).click();
  await page.getByRole('button', {name: /Enviar denúncia/}).click();
  await expect(page.getByRole('dialog')).toContainText('Denúncia registrada');
  await page.getByRole('link', {name: /Ver moderação de teste/}).click();
  await expect(page).toHaveURL(/#admin$/);
  await expect(page.getByRole('heading', {name: /Moderação e denúncias/})).toBeVisible();
  await expect(page.locator('.listing-line').filter({hasText:'Suspeita de golpe'})).toBeVisible();
  await page.screenshot({path: testInfo.outputPath('moderacao.png'), fullPage: true, animations: 'disabled'});
});

test('cadastro fictício leva ao anúncio e o estado não persiste após atualizar', async ({page}) => {
  const title = 'Bicicleta fictícia da auditoria';
  await page.goto('/#cadastro');
  await expect(page.getByRole('heading', {name: 'Cadastro do vendedor'})).toBeVisible();
  await page.getByRole('textbox', {name: 'Nome de exibição'}).fill('Comércio de Teste');
  await page.getByRole('textbox', {name: 'E-mail'}).fill('teste@example.invalid');
  await page.getByRole('textbox', {name: 'WhatsApp comercial'}).fill('(92) 90000-0000');
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', {name: 'Criar conta de demonstração'}).click();
  await expect(page.getByRole('dialog')).toContainText('Cadastro simulado');
  await page.getByRole('link', {name: /Continuar para criar anúncio de teste/}).click();
  await expect(page).toHaveURL(/#publicar$/);
  await page.getByRole('textbox', {name: 'Título'}).fill(title);
  await page.getByRole('textbox', {name: 'Preço em reais'}).fill('75,00');
  await page.getByRole('textbox', {name: 'Descrição'}).fill('Bicicleta totalmente fictícia para teste automatizado de publicação.');
  await page.getByRole('textbox', {name: 'Atendimento ou entrega'}).fill('Retirada fictícia no bairro');
  await page.getByRole('button', {name: 'Publicar (simulação)'}).click();
  await expect(page.getByRole('dialog')).toContainText('PUBLICADO');
  await page.getByRole('link', {name: 'Ir ao painel'}).click();
  await expect(page.locator('.listing-line')).toContainText([title]);
  await page.goto('/#catalogo');
  await page.getByRole('textbox', {name: 'Buscar anúncios'}).fill(title);
  await expect(page.locator('.listing-card')).toHaveCount(1);
  await page.reload();
  await page.getByRole('textbox', {name: 'Buscar anúncios'}).fill(title);
  await expect(page.locator('.listing-card')).toHaveCount(0);
});

test('layout não ultrapassa a tela e atalhos móveis funcionam', async ({page}, testInfo) => {
  await page.goto('/#inicio');
  await expect.poll(async () => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  )).toBeLessThanOrEqual(2);

  const shortcuts = page.getByRole('navigation', {name: 'Atalhos para celular'});
  if (testInfo.project.name.startsWith('mobile')) {
    await expect(shortcuts).toBeVisible();
    const search = shortcuts.getByRole('link', {name: /Buscar/});
    const rect = await search.boundingBox();
    expect(rect?.height).toBeGreaterThanOrEqual(44);
    await search.click();
    await expect(page).toHaveURL(/#catalogo$/);
    await expect(page.getByRole('heading', {name: 'Catálogo'})).toBeVisible();
  } else {
    await expect(shortcuts).toBeHidden();
  }
});

test('se fotos externas falharem, o anúncio mantém uma alternativa visível', async ({page}) => {
  await page.route('**/images.unsplash.com/**', route => route.abort());
  await page.goto('/#inicio');
  await expect(page.locator('.hero-visual-fallback')).toBeVisible();
  const imageCard = page.locator('.listing-card').first();
  await expect(imageCard.locator('.photo-fallback')).toBeVisible();
  await expect(imageCard.locator('.listing-image-label')).toHaveText(/Foto ilustrativa|Ilustração da categoria/);
});

