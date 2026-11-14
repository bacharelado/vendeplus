# Segurança do VENDE+

## Controles implementados

- Senhas com scrypt e sal individual; sessão aleatória com token armazenado por hash. Cookies `__Host-`, `HttpOnly`, `Secure` e `SameSite=Lax`.
- Escritas exigem origem do próprio site. JSON é validado por tipo, tamanho em bytes e leitura limitada do fluxo, mesmo sem `Content-Length`.
- Consultas SQL parametrizadas e autorização por proprietário no servidor. O vendedor não pode escolher permissões ou o proprietário de um anúncio.
- Edições usam comparação de status para não desfazer remoção, rejeição ou pausa concorrente. As alterações e os eventos são agrupados no D1.
- CSP sem scripts inline ou `eval`, proibição de enquadramento, HSTS em HTTPS, `nosniff` e restrição de câmera, microfone e geolocalização. O frame externo autorizado é o Google Drive usado pelo vídeo.
- Respostas das APIs e erros não ficam em cache. Caminhos inexistentes têm HTTP 404; APIs inexistentes retornam JSON.
- Upload autenticado, validação e reprocessamento da imagem, cotas e verificação de propriedade. A entrega depende de anúncio publicado e vendedor não suspenso.
- Limites persistentes para autenticação, publicação, fotos e denúncias. Denúncias inválidas não entram na fila e a leitura de corpos excessivos é interrompida.
- Alteração de senha encerra as outras sessões. A recuperação por e-mail foi retirada; o login oferece suporte no WhatsApp, sem redefinição automática ou envio de dados da conta.

## Verificação

```bash
npm ci
npm test
python3 tests/schema_test.py
npm audit --audit-level=moderate
npm run build
npm run test:e2e
node scripts/smoke-http.mjs https://vendeplus.pages.dev/
```

Os testes Node usam bancos SQLite isolados, incluindo isolamento entre duas contas e disputas entre edição e moderação. Os testes Playwright usam APIs simuladas para validar a interface em computador e celular. O smoke HTTP só lê a publicação online. Nenhum desses resultados substitui uma auditoria completa ou prova ausência de vulnerabilidades.

## Limites que exigem trabalho operacional

- Preparar uma ferramenta de redefinição para o suporte após confirmar a titularidade. Não usar nome, telefone informado ou outros dados públicos como prova suficiente, nem solicitar senhas ou códigos por mensagem.
- Fortalecer a autenticação administrativa com um segundo fator e uma política de recuperação adequada. O login atual não possui MFA próprio.
- Verificar controle de WhatsApp: contas `pending` podem publicar anúncios comuns, e o produto não deve afirmar que esse contato foi verificado.
- Manter tratamento de denúncias, contestação, retenção/exclusão de dados, termos e política de privacidade definidos para a operação.
- Testar backup/restauração, carga, limites de infraestrutura e alertas de custo. As cotas do código não substituem os limites do provedor.
- A busca e a ordenação da interface consideram as páginas carregadas, com aviso quando há mais resultados. Busca global e indexação por anúncio exigem evolução da arquitetura.

Referências: [Cloudflare Pages e respostas 404](https://developers.cloudflare.com/pages/configuration/serving-pages/), [headers em Functions](https://developers.cloudflare.com/pages/configuration/headers/) e [CSP da OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html).
