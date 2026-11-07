# VENDE+ — vitrine de produto e dados reais

## Mudança de experiência

A interface pública removeu o banner de demonstração, alternância de papéis, métricas inventadas, cadastro que simulava uma conta e publicação que apenas alterava a memória da página. Os dados fixos de produtos foram removidos do código de produção.

A nova vitrine tem identidade visual consistente, categorias, busca, filtros, detalhes, ajuda de compra, tema escuro e navegação mobile. Não apresenta ofertas que não tenham vindo da API. Os estados de carregamento, catálogo vazio e catálogo indisponível são distintos.

## Funcionalidades disponíveis

Rascunhos podem ser criados, alterados e excluídos neste navegador. São persistidos em `localStorage` e não são anúncios públicos. A interface informa esse limite antes do salvamento. Erros de quota ou bloqueio do armazenamento não geram sucesso falso. A leitura rejeita dados inválidos e as abas recebem atualizações de armazenamento.

O catálogo faz GET em `/api/listings`. A Pages Function executa uma consulta restrita a anúncios publicados de vendedores aprovados. Só campos destinados ao catálogo público são serializados. Métodos de escrita recebem 405; erros e ausência do banco recebem 503 sem detalhes internos. Nenhum registro é semeado pela migração.

O esquema usa as tabelas `marketplace_sellers` e `marketplace_listings`, chave estrangeira, estados enumerados, limites de tamanho, preços inteiros em centavos e índices. Preço vazio é permitido apenas para Serviços. O WhatsApp precisa estar em formato brasileiro com DDI 55 para virar link no detalhe; a aplicação não envia mensagens automaticamente.

## Conexão atual e integrações pendentes

Em 07/11/2026, a automação [42416744909](https://github.com/bacharelado/vendeplus/actions/runs/42416744909) confirmou o banco `vendeplus-preview`, a migração e o binding `MARKETPLACE_DB` somente no ambiente de prévia. O deployment da branch de desenvolvimento foi refeito e a API retornou uma lista vazia de anúncios. A configuração e o deployment de produção permaneceram iguais. A conferência no navegador também mostrou o catálogo disponível com zero ofertas. O Vite local não executa Pages Functions.

A conexão usou um banco exclusivo da prévia, sem reutilizar dados de produção, e a migração `migrations/0001_marketplace.sql`. Os rascunhos locais não foram enviados ao banco e nenhum vendedor ou anúncio fictício foi inserido. A conexão de produção continua dependendo de aprovação expressa e não foi realizada.

A criação de conta, publicação online, moderação autenticada, imagens enviadas por vendedores e denúncias persistidas não estão implementadas. Não há botão público que finja concluir essas operações. A rota antiga de administração apenas informa que não está disponível na área pública.

## Verificação

- Testes Node para preços, filtros, rascunhos e contrato da Pages Function.
- Testes Python/SQLite executando a migração e a consulta reais: somente vendedor aprovado + anúncio publicado aparece; preços e referências inválidos são rejeitados.
- Playwright atualizado para os fluxos atuais em computador e celular, com verificação adicional de largura em 320 px.
- A suíte antiga da interface com papéis simulados foi substituída porque essas funcionalidades foram removidas. A auditoria anterior e seus resultados continuam históricos e não descrevem o estado operacional atual.

A consulta de D1 e o formato de Pages Function seguem a documentação oficial: https://developers.cloudflare.com/pages/functions/bindings/.

## Publicação

Somente a branch `feat/ux-compra-venda-v2` e o PR #2 são alterados. Não fazer merge, provisionar recursos de produção ou ativar a versão principal sem aprovação expressa do CEO.

## Automação de conexão da prévia

O workflow `.github/workflows/database-preview.yml` usa o segredo de repositório `CLOUDFLARE_API_TOKEN`. A execução 42416744909 concluiu com sucesso e confirmou o estado remoto. As tentativas iniciais criaram o banco, aplicaram as tabelas e fizeram o binding, mas falharam ao listar deployments com um parâmetro de paginação recusado pelo provedor. A consulta foi corrigida para usar a paginação padrão; a reexecução reutilizou o mesmo banco, sem duplicação.

O script `scripts/connect-preview-database.mjs` recusa a branch principal, banco compartilhado com produção, binding já ocupado por outro banco e deployment que não seja da branch/commit de desenvolvimento. A migração é idempotente e não semeia dados. O token é enviado apenas à API oficial da Cloudflare; a validação da URL pública não recebe credenciais. Respostas de erro do provedor não são copiadas integralmente para logs.

Os testes usam um provedor controlado e conferem preservação de produção, isolamento de segredo, reexecução, falhas de migração/build/API e ausência de acesso de rede sem o segredo. Esses testes não substituem a execução real da conexão.
