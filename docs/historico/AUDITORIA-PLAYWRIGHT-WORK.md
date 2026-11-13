# Auditoria visual e funcional do VENDE+

Este projeto tem duas formas complementares de revisão, sem mexer na produção sem aprovação.

## 1. Auditoria automática — Playwright e GitHub Actions

Workflow: `.github/workflows/playwright.yml`.

Os testes de `tests/e2e/marketplace.spec.mjs` executam o site no navegador Chromium, em dois perfis: computador e celular (emulação Pixel 7). Em cada PR para `main`, o GitHub:

1. Instala as dependências do projeto e o Playwright;
2. Abre a versão da branch num servidor Vite de teste;
3. Confere página inicial, navegação, busca, categorias e ordenação;
4. Testa detalhe do anúncio, contato demonstrativo, compartilhamento, denúncia e cadastro fictício;
5. Verifica a publicação fictícia, a ausência de persistência e o layout sem rolagem horizontal;
6. Simula indisponibilidade de fotos externas para garantir alternativa visual;
7. Salva capturas de tela, traces, gravações de erro e relatório HTML na execução do GitHub Actions.

Para revisar: abra **GitHub → Actions → VENDE+ — Auditoria no navegador → execução → Artifacts**. Os relatórios são retidos por **7 dias**.

**Importante:** capturas de tela são geradas para observação humana; não existe comparação pixel a pixel (visual regression) ainda. As imagens de anúncios são ilustrativas e vêm de um serviço externo — os testes cobrem o fallback, mas não garantem que fotos remotas estejam disponíveis em todo lugar.

### Executar no Windows

No diretório do repositório:

```cmd
npm ci
npx playwright install chromium
npx playwright test
npx playwright show-report
```

O último comando abre os resultados visuais. Não envolve ZIP, nem altera a branch principal.

### Testar um endereço publicado

Quando este workflow estiver na branch principal, use **GitHub → Actions → VENDE+ — Auditoria no navegador → Run workflow**. O campo opcional `target_url` aceita somente `https://vendeplus.pages.dev` e seus subdomínios, como a prévia da branch. Se vazio, os testes rodam no Vite local no runner.

**Atenção:** os testes de publicação/denúncia funcionam apenas com **dados fictícios mantidos na memória do navegador**. Nunca usar credenciais ou contatos reais nesta versão.

## 2. Inspeção por IA em navegador — ChatGPT Work

Para revisão guiada, abra uma conversa no modo **Work** e peça:

> Acesse a prévia https://feat-ux-compra-venda-v2.vendeplus.pages.dev e navegue como comprador e vendedor, no desktop e no celular. Avalie legibilidade, imagens, cores, cliques, navegação e possíveis erros. Entregue evidências e uma lista de problemas priorizados. Use o repositório GitHub bacharelado/vendeplus para propor correções em branch e pull request, sem alterar a main sem aprovação.

A navegação interativa com Work precisa ser iniciada pelo usuário no produto; o workflow GitHub Actions não ativa o Work. Uma análise manual continua necessária para problemas estéticos e de negócio.

## Política de publicação

O site principal só muda quando a atualização for revisada e a alteração aprovada. **Build verde não prova ausência de bugs**: resultados dos testes devem ser analisados e problemas reportados devem gerar correções e novos testes.

