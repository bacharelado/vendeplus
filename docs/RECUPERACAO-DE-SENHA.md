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
