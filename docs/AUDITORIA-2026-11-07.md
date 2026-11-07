# Auditoria de qualidade — VENDE+ — 07/11/2026

Registro histórico da versão auditada. Para o estado atual, consulte [Implementação do marketplace](IMPLEMENTACAO-MARKETPLACE.md).

A demonstração recebeu correções de acessibilidade, navegação, validação e moderação na branch `feat/ux-compra-venda-v2`, no PR #2. O projeto continua demonstrativo; não está pronto para operar um marketplace com dados reais.

## Escopo e método

- Código inicial revisado: `23e05381228e67745f1809bbae13842b1091b4cd`.
- Inspeção interativa da prévia Cloudflare e da versão corrigida; consulta somente de leitura da versão principal.
- Páginas: início, catálogo, detalhe, cadastro fictício, publicação, painel, administração e anúncio indisponível.
- Perfis: comprador, vendedor e administrador de demonstração; dados inventados e domínio `example.invalid`.
- Testes de navegador em Chromium: computador 1280 px, emulação de celular Pixel 7/393 px e verificação adicional de todas as páginas em 320 px. Emulação não substitui aparelho físico.
- Inspeção visual das capturas de todas as páginas em computador e celular. Conferência de temas claro/escuro, fotos e ilustrações, rolagem, navegação, campos e botões.
- A versão inicial já passava nos testes existentes e compilava; ainda assim apresentava os problemas abaixo.

## Problemas confirmados e tratamento

| Prioridade | Evidência / reprodução antes da correção | Correção |
| --- | --- | --- |
| Alta | Em `#anuncio-1`, alternar para tema escuro: o texto claro do aviso de segurança permanece sobre fundo quase branco. Ver captura antes. | Cores próprias para avisos, etiquetas, indicadores e seleção mobile no tema escuro; links e texto secundário também escurecidos no tema claro. Testes de contraste mínimo 4,5:1 nos textos selecionados de ambos os temas. |
| Alta | `Modal` mantinha foco no botão de abertura; não confinava Tab nem tornava o fundo inerte. Na CSS, `.overlay` tinha `z-index:10`, abaixo da barra mobile (`20`). | Elemento `dialog` nativo na camada superior, confinamento de Tab/Shift+Tab, foco inicial, Escape, devolução de foco e bloqueio de rolagem do fundo. |
| Alta | Criar título/descrição só com espaços satisfazia `minLength` do HTML; o código fazia `trim()` sem validar o resultado e publicava conteúdo vazio. | Validação após remoção dos espaços, mensagem específica e preservação do preenchimento para correção. Cadastro também rejeita campos apenas com espaços. |
| Média | Publicar um item novo e compartilhar gerava `#anuncio-9`; outro navegador ou recarregamento não possui esse item. | Compartilhamento de itens temporários explica o limite sem oferecer link enganoso. Exemplos iniciais continuam compartilháveis e têm alternativa de cópia manual. |
| Média | `#admin` mostrava denúncias e botão Resolver, mas não permitia revisar os anúncios `EM_ANALISE` nem retirar um item denunciado do catálogo. | Fila demonstrativa com aprovação/rejeição, retirada de denunciados e resolução da denúncia. Todas as ações continuam somente na memória da sessão. |
| Média | Reativação consultava novamente o filtro por palavras mesmo após uma aprovação administrativa; um anúncio aprovado podia ser pausado e ficar impedido de voltar. | Anúncios pausados, que já estavam publicados e não podem ser editados nesta demo, voltam a publicados. Teste cobre aprovação → pausa → reativação. |
| Média | Cadastro exigia aceitar “termos (ainda não publicados)”. | Substituído por reconhecimento explícito da simulação, sem alegar aceite de documento inexistente. |
| Média | Fotos não correspondiam aos itens: camiseta branca anunciada como preta, sofá verde descrito como cinza, fotografia de refeição diferente e celular sem correspondência ao modelo informado. | Removidas sete imagens incompatíveis; ilustrações de categoria com rótulo explícito. Mantidas a foto genérica de barbearia e a imagem decorativa da vitrine. Upload de fotos reais permanece pendente. |
| Média | Em celular, a largura somada dos links do menu cortava as últimas opções; o rodapé não reservava espaço para a barra fixa. | Menu quebra linha e mantém alvos de 44 px; rodapé reserva espaço para barra e área segura. |
| Média | A abertura com foto decorativa, busca em coluna e categorias em duas colunas empurrava a vitrine para muito abaixo da primeira tela no celular. | Abertura compacta, busca em linha, três categorias por linha e foto decorativa reservada ao computador. Teste exige categorias já presentes no viewport mobile. |
| Baixa | “Novidades” usava `visible.slice(0,4)` em ordem crescente dos exemplos; publicações novas ficavam fora da vitrine. | Vitrine usa a mesma ordenação recente do catálogo. |
| Baixa | Após mudança de página, foco permanecia em link anterior; menu e filtros não anunciavam claramente sua seleção. | Atalho “Pular para o conteúdo”, foco no conteúdo após navegação, `aria-current`, `aria-pressed` e contagem de resultados com status. |
| Baixa | Botão Resolver continuava ativo após encerrar a denúncia, permitindo registros repetidos na auditoria. | Ações exibidas somente para denúncias abertas. |
| Baixa | Gradientes de botões tinham trechos claros demais para o texto branco pequeno. | Gradientes principais escurecidos; foco visível e área mínima de interação preservados. |
| Manutenção | `npm ci` não instalava Playwright; o workflow fazia uma instalação paralela sem lock. README ainda orientava entrega por ZIP e relatava build não validado. | Playwright fixado no lock, script `test:e2e`, documentação de clone da branch e verificações atuais. Saídas de teste e build ignoradas no Git. |

## Evidências visuais

As duas capturas abaixo são observações reais do navegador. A escala/altura das capturas difere; não são uma comparação automática pixel a pixel. A foto incoerente foi substituída por ilustração e o aviso de segurança ganhou contraste no tema escuro.

**Antes — aviso quase ilegível:**

[Abrir captura antes](https://chatgpt.com/library?file_id=libfile_e1b6adaa2ed88191bef3f098b8acfe0d&account_id=personal)

**Depois — aviso legível:**

[Abrir captura depois](https://chatgpt.com/library?file_id=libfile_06c2a841f1108191be1c4582201042b3&account_id=personal)

[Captura completa no celular](https://chatgpt.com/library?file_id=libfile_92faeac5e3688191b883b715feda41d9&account_id=personal)

As capturas completas de todas as páginas, inclusive 320 px, ficam nos artefatos da execução de Playwright indicada no PR. A retenção desses artefatos é de 7 dias; as capturas de antes/depois e celular foram preservadas separadamente nos links acima.

## Testes e limites de verificação

- Local: instalação por `npm ci`, 9 testes unitários aprovados, TypeScript e build Vite aprovados.
- Local: execução E2E não iniciou por ausência de Chromium; o download retornou arquivo inválido. Isso é um limite do ambiente local, não uma falha funcional do site.
- GitHub Actions: execução inicial ampliada teve 28 aprovações e 4 falhas de verificações nos testes, corrigidas sem esconder falhas: o DOM preserva o menu sob `dialog` nativo embora ele esteja inerte; a nova fila tornou `.stack` ambígua. A verificação passou a testar bloqueio de clique no fundo e localizar a denúncia específica.
- Execução seguinte: **32/32 testes E2E aprovados**, em computador e celular: [execução 42409283673](https://github.com/bacharelado/vendeplus/actions/runs/42409283673).
- A suíte ampliada teve **34/34 cenários aprovados** (17 por perfil), incluindo a regressão adicional de reativação após aprovação: [execução 42409488640](https://github.com/bacharelado/vendeplus/actions/runs/42409488640). A rodada após a compactação mobile está vinculada no PR, junto à prévia correspondente.
- Cobertura: pesquisa, filtros e ordenação, limpeza, detalhe, WhatsApp simulado, compartilhamento e fallback de clipboard, denúncia, cadastro fictício, publicação, preço inválido, serviço sob orçamento, espaços vazios, classificação bloqueada/em análise, suspensão emergencial, pausa, reativação, vendido, aprovação, rejeição, retirada, resolução, recarregamento sem persistência, anúncio inexistente, imagens indisponíveis, foco, Escape, contraste e largura das telas.
- Capturas e verificações de largura não constituem certificação completa WCAG. Não houve teste em iPhone/Safari, Firefox, aparelho físico, leitor de tela real, rede lenta controlada ou medição de Core Web Vitals.
- Não houve teste de autenticação, banco ou pagamento real: esses componentes não existem nesta versão. Não houve pentest de backend nem integração com números reais.

## GitHub, Cloudflare e produção

- [PR #2](https://github.com/bacharelado/vendeplus/pull/2), mantido aberto; nenhuma mesclagem realizada.
- [Prévia da branch](https://feat-ux-compra-venda-v2.vendeplus.pages.dev), atualizada automaticamente pelo Cloudflare Pages.
- `main` permaneceu em `50e627463bf322b1973717f437aa91c5d0e6a801` durante a auditoria. A página principal foi apenas consultada.
- O check **Cloudflare Pages** publicou a prévia com sucesso. O check separado **Workers Builds: vendeplus** já falhava antes da auditoria e continuou falhando. A causa não é exposta no resumo do GitHub; não há evidência suficiente para afirmar por que falha. Não foram alteradas configurações de produção ou credenciais para tentar resolvê-lo.

## Próxima etapa recomendada

1. Revisar a prévia e as decisões visuais com o CEO, especialmente o uso de ilustrações temporárias. Fotos reais, coerentes e otimizadas dos vendedores devem substituir esses exemplos antes de um piloto comercial.
2. Esclarecer no Cloudflare se a integração Workers é necessária, lendo os logs no projeto correto. Consolidar o pipeline e definir checks obrigatórios após decisão de infraestrutura; não resolver o check adicionando um deploy de produção à branch.
3. Modularizar `App.tsx` e consolidar as regras CSS duplicadas antes de aumentar o escopo. Manter esta suíte como base de regressão e adicionar testes de acessibilidade mais abrangentes e de outros navegadores.
4. Implementar backend em ambiente isolado: sessão, autorização por dono do anúncio, administração protegida, persistência de anúncios/denúncias e auditoria no servidor. Testar permissões e recuperação de dados.
5. Implementar upload validado e confirmação do WhatsApp; elaborar e revisar os documentos e processos necessários para público real. A classificação por palavras nesta interface não pode ser usada como controle de segurança.
6. Validar com poucos moradores/comerciantes do Poranga II, medir dificuldades e desempenho em celulares reais e conexão limitada. Pagamentos continuam fora deste escopo.

A auditoria melhora a qualidade do protótipo e sua cobertura de regressão; não autoriza lançamento comercial nem alteração da versão principal.
