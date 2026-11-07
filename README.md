# VENDE+

Marketplace comunitário do Poranga II, Itacoatiara-AM. Produto APOCALYPTIC.

## Desenvolvimento

Node.js 22.12+ e Git:

```sh
git clone --branch feat/ux-compra-venda-v2 https://github.com/bacharelado/vendeplus.git
cd vendeplus
npm ci
npm run dev
```

## O que funciona

- Vitrine responsiva, categorias, pesquisa, filtros, ordenação, temas e navegação por teclado.
- Rascunhos salvos no navegador, com edição, exclusão confirmada, persistência e tratamento de erro de armazenamento.
- Catálogo servido por `/api/listings`, sem anúncios pré-carregados no cliente.
- API somente de leitura, preparada para Cloudflare Pages Functions e banco D1.
- Esquema SQL com restrições e consulta que exige anúncio publicado e vendedor aprovado.
- Detalhe e compartilhamento dos anúncios retornados pela API. Link do WhatsApp somente quando o servidor fornece um contato válido.

## Situação operacional

A vinculação do banco `MARKETPLACE_DB` não foi configurada. Sem o banco ou em caso de erro, a API retorna 503 e a interface mostra o catálogo indisponível; não substitui dados ausentes por produtos inventados.

A publicação online, contas de vendedores, uploads, autenticação e administração protegida ainda precisam de implementação. Os rascunhos são privados do navegador e não são enviados a um servidor.

A branch de desenvolvimento atualiza a prévia do Cloudflare Pages. A versão principal exige aprovação expressa do CEO antes de merge ou publicação.

## Verificações

```sh
npm test
python3 tests/schema_test.py
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Os testes E2E usam respostas de API controladas exclusivamente no ambiente de testes. Não gravam anúncios públicos nem enviam mensagens. Capturas e relatórios ficam nos artefatos do GitHub Actions.

## Linguagens

| Linguagem | Uso |
| --- | --- |
| TypeScript / TSX | Interface React, contrato do catálogo e Pages Function |
| JavaScript | Persistência local, preços, filtros e testes |
| HTML | Documento de entrada e metadados |
| CSS | Identidade visual, temas e responsividade |
| SQL | Esquema relacional e consulta do catálogo |
| Python | Testes do esquema com SQLite real em memória |

O código de aplicação e os novos testes não contêm comentários.

[Estado da implementação](docs/IMPLEMENTACAO-MARKETPLACE.md) · [Diretrizes](docs/DECISOES.md) · [Próximos controles de segurança](docs/SEGURANCA.md)
