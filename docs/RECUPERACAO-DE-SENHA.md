# Recuperação de senha do VENDE+

## Implementação
- Entrada: link Esqueci minha senha no login.
- Solicitação: POST /api/account/password-reset/request.
- Disponibilidade: GET /api/account/password-reset/status.
- Redefinição: POST /api/account/password-reset/confirm.
- Token aleatório de 32 bytes; somente SHA-256 do token fica no D1.
- Prazo de 15 minutos; uso único e confirmação em batch transacional.
- Redefinição encerra todas as sessões e invalida todos os outros links da conta.
- Alteração manual de senha também invalida links anteriores.
- Resposta de solicitação não informa se existe conta com o e-mail.
- Limites por IP, e-mail e global. Tokens e senhas não entram em logs.
- Link no fragmento da URL; a tela remove o token da barra ao abrir.
- Nenhum envio de recuperação ocorre sem solicitação no formulário.
- Nenhuma sessão é criada automaticamente após redefinir a senha.

## Configuração para ativar
No projeto vendeplus do Cloudflare Pages, definir em Production e, separadamente, em Preview:
1. RESEND_API_KEY como segredo, com permissão restrita a envio.
2. PASSWORD_RESET_FROM como remetente de um domínio verificado no Resend.
3. PASSWORD_RESET_ENABLED=true apenas depois de confirmar o remetente.

Não utilizar onboarding@resend.dev para usuários reais: o remetente de teste não envia para destinatários arbitrários. Sem domínio verificado e credencial, o envio fica indisponível e a interface explica a situação; não promete suporte manual.

A migração 0004 cria a tabela sem alterar contas. O workflow de preparação verifica a lógica com banco SQLite descartável e entrega de e-mail simulada, depois cria a tabela nos dois bancos isolados. Os testes não enviam mensagens nem alteram contas reais.

## Estado na entrega
Canal de e-mail depende de configuração da conta do proprietário. Não foram criadas contas de provedor, comprados domínios ou ativados serviços pagos. Confirmar entrega real de ponta a ponta após configurar o remetente; testes com entrega simulada não comprovam a entrega real.

## Migração 0004: execução controlada (após aprovação da alteração)

A automação agora é **somente manual** e exige execução na branch `main`. Não dispara em commits ou pull requests. Ela só aplica `CREATE TABLE/INDEX IF NOT EXISTS` da migração 0004, no ambiente escolhido, sem apagar nem substituir contas ou anúncios.

1. No GitHub, abra **Actions → VENDE+ — Preparar recuperação de senha → Run workflow**, com a branch `main`.
2. Escolha `preview` primeiro. Deixe `confirm_production` vazio. O job testa o fluxo, confirma os bindings distintos de D1, aplica a migração somente no banco `vendeplus-preview` e compara a contagem de contas antes/depois.
3. Confirme o resultado do workflow e faça um teste com e-mail/conta exclusivamente de teste na prévia, depois de configurar o provedor.
4. Somente após validar e autorizar a preparação de produção, execute outra vez escolhendo `production` e preenchendo `confirm_production` exatamente com `APLICAR_MIGRACAO_0004`. A alteração alcança apenas `vendeplus-production`.

A automação exige o segredo `CLOUDFLARE_API_TOKEN` existente no GitHub Actions com acesso restrito a ler o projeto Pages e executar SQL em D1. **Ela não cadastra nem revela credenciais de e-mail, não habilita recuperação e não dispara mensagens.** Caso faltem as credenciais, ela falhará sem ativar o recurso. Não envie tokens nem chaves pelo chat ou para o GitHub.

Para ativar a funcionalidade após migrar os bancos, configure `RESEND_API_KEY` como segredo, `PASSWORD_RESET_FROM` com um remetente de domínio verificado e `PASSWORD_RESET_ENABLED=true` nas variáveis do Pages, primeiro em Preview. Reimplante a prévia se necessário, confirme `GET /api/account/password-reset/status` com `available:true` e teste entrega, expiração, uso único, nova senha e encerramento das sessões. Só então repita a configuração em Production, validando em conta de teste sem afetar usuários reais.

Se não houver domínio verificado, **não habilite a recuperação em produção**; os remetentes de teste do Resend não atendem qualquer e-mail de vendedor.
