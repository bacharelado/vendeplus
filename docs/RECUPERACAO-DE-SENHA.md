# Atendimento para recuperação de acesso

Por decisão do proprietário em 14/11/2026, a recuperação por e-mail foi retirada. O login oferece contato direto com o suporte no WhatsApp **+55 92 8166-0856**, o mesmo contato do criador já divulgado no site.

- O link abre uma mensagem genérica solicitando ajuda. Ele não transmite automaticamente o e-mail, a senha, códigos ou dados da conta.
- O visitante revisa e envia a mensagem no próprio WhatsApp.
- Links antigos `#entrar?recuperar` e `#entrar?redefinir=TOKEN` mostram o atendimento; tokens antigos são removidos da barra e não são enviados ao WhatsApp.
- `GET /api/account/password-reset/status` informa `available:false`, canal `whatsapp` e o endereço de suporte.
- Os antigos pedidos e confirmações por e-mail retornam HTTP 410. Não enviam e-mails, criam tokens, autenticam usuários ou alteram senhas.
- O código de envio e a preparação de recuperação por e-mail foram removidos. Migrações e dados existentes são preservados.
- A alteração de senha dentro de uma conta autenticada continua exigindo a senha atual e encerrando as demais sessões.

## Limite do atendimento atual

O WhatsApp recebe o pedido de ajuda; esta alteração não cria uma ferramenta de redefinição administrativa. A senha existente é armazenada com hash e não pode ser consultada pelo administrador. Qualquer futura redefinição precisa confirmar a titularidade, registrar a ação e encerrar sessões antigas. Não considerar nome, e-mail informado ou outros dados públicos como prova suficiente, nem pedir senhas ou códigos de acesso por mensagem.
