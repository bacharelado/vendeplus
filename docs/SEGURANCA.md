# Condições de segurança antes de produção

- Não confiar em validação de navegador ou classificação simples por palavras.
- Exigir sessão e autorização no servidor para criar, editar e retirar anúncios; testes de propriedade (IDOR).
- RLS por tabela e políticas de leitura mínima; preservar denúncias mesmo com exclusão lógica de anúncios.
- Verificação manual do WhatsApp comercial antes do primeiro anúncio público.
- Fluxos de denúncia, contestação, auditoria e bloqueio emergencial com autenticação MFA de administradores.
- Uploads em armazenamento privado temporário, validação do arquivo real, recodificação e remoção de metadados.
- Cotas de requisição, proteção contra spam e abuso, HTTPS, política de retenção e recuperação de backup testada.
- Política de Privacidade e Termos de Uso adequados ao Brasil e à LGPD; não prometer compras seguras ou vendedores verificados.
