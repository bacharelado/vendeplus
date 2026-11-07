# VENDE+

Marketplace comunitário de Poranga e Jacarezinho, Itacoatiara-AM. Produto APOCALYPTIC.

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
- Cadastro e login reais com sessão protegida e envio de anúncios ao D1 para revisão.
- Área do vendedor com isolamento por proprietário e revisão administrativa autenticada.
- Esquema SQL com restrições e consulta que exige anúncio publicado e vendedor aprovado.
- Detalhe e compartilhamento dos anúncios retornados pela API. Link do WhatsApp somente quando o servidor fornece um contato válido.

## Situação operacional

O banco D1 `vendeplus-preview` está configurado com o binding `MARKETPLACE_DB` somente na prévia. As tabelas foram aplicadas e a API foi validada em 07/11/2026 na [execução 42416744909](https://github.com/bacharelado/vendeplus/actions/runs/42416744909), retornando um catálogo vazio. A configuração e o deployment de produção foram preservados. Sem o banco ou em caso de erro, a API retorna 503; a interface não inventa ofertas.

Cadastro, login e envio online foram implementados e validados no D1 da prévia. Anúncios novos ficam em análise até a aprovação do vendedor e do anúncio. Os rascunhos locais só são enviados quando o usuário escolhe Enviar online e confirma o formulário. A primeira conta administradora ainda precisa ser indicada pelo CEO. Recuperação de senha, verificação automática de contatos, uploads e edição online continuam pendentes. Veja [Contas e publicação](docs/CONTAS-E-PUBLICACAO.md).

A branch de desenvolvimento atualiza a prévia do Cloudflare Pages. A versão principal exige aprovação expressa do CEO antes de merge ou publicação.

## Conectar o banco da prévia

A automação `VENDE+ — Conectar banco da prévia` usa o segredo de repositório `CLOUDFLARE_API_TOKEN`. O token deve ter D1 Edit e Cloudflare Pages Edit somente na conta do VENDE+; seu valor nunca deve ser colocado em arquivos, comentários ou mensagens.

O workflow executa somente na branch `feat/ux-compra-venda-v2`. Ele identifica ou cria `vendeplus-preview`, aplica a migração existente, preserva os outros bindings, vincula `MARKETPLACE_DB` somente em `deployment_configs.preview` e refaz um deployment de prévia do mesmo commit. Antes de confirmar sucesso, valida a API pública e confere que a configuração e o deployment de produção permanecem iguais.

A execução inicial é disparada pelo push dos arquivos da automação. Se o segredo ainda não existir, o job encerra antes de qualquer chamada à Cloudflare. Após cadastrar o segredo, reexecute esse job no GitHub Actions. Não é necessário mesclar a branch para executar a configuração.

O provisionamento não semeia produtos ou vendedores. O teste de integração cria contas temporárias privadas e as remove ao terminar. A publicação exige autenticação e autorização. Um catálogo vazio após a conexão é o resultado esperado enquanto não houver anúncios aprovados no banco.

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
