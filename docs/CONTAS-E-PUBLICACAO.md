# Contas e envio online na prévia

## Comportamento

Visitantes exploram o catálogo sem cadastro. Moradores e comerciantes de Poranga I, Poranga II e Jacarezinho podem criar uma conta em `#cadastro`, entrar em `#conta` e enviar ofertas ao banco. O rótulo público da região é Poranga e Jacarezinho.

Os rascunhos continuam locais e podem ser enviados pelo botão Enviar online. Antes do envio, o vendedor confere os dados e escolhe o bairro da oferta. Um envio confirmado fica no D1, aparece na área do proprietário e permanece disponível ao entrar em outro aparelho. Somente cadastro aprovado e anúncio publicado aparecem na consulta pública. O envio não equivale à publicação.

A autenticação usa senha de 8 a 128 caracteres, scrypt com salt individual, sessão aleatória de 256 bits e cookie `__Host-vendeplus`, HttpOnly, Secure, SameSite=Lax, válido por sete dias. O banco guarda somente o hash da sessão. Logout remove a sessão no servidor; sessões expiradas ou de vendedores suspensos não autorizam operações. Não há credencial no armazenamento local.

As escritas exigem origem idêntica e JSON, têm limite de corpo e usam parâmetros SQL. Os limites de tentativas de acesso e de envio ficam no D1. As chaves de limitação não armazenam IP/e-mail em texto. Cada consulta e alteração de vendedor confere o proprietário no servidor; a API ignora privilégios e status enviados no cadastro. A repetição de uma solicitação de envio com o mesmo identificador não cria outro anúncio.

O vendedor pode retirar suas ofertas, pausar um anúncio publicado ou marcá-lo vendido. A interface atual não oferece edição online nem retomada de anúncio pausado: um novo conteúdo passa por nova revisão. As alterações de status passam a valer na consulta pública; a navegação para o catálogo atualiza os dados.

## Revisão

`#admin` exige sessão administrativa. Uma conta comum recebe 403 da API, inclusive se tentar chamar os endpoints diretamente. A administração pode conferir o contato, registrar a aprovação do vendedor, aprovar ou rejeitar o anúncio. A confirmação de contato é humana: o sistema não envia código nem afirma que o telefone já foi verificado. Publicar exige aprovação prévia do vendedor. As decisões possuem registro de autor e data no D1.

Nenhuma conta administrativa foi criada, promovida ou escolhida em nome do CEO. Para ativar a operação, o responsável deve criar a própria conta, indicar o identificador a ser autorizado e confirmar a promoção. A alteração deve ocorrer no banco da prévia, por um operador com acesso confiável, conferindo o identificador e o e-mail antes de atribuir `role='admin'`. Não existe endpoint de autopromoção, senha padrão ou opção de escolher o próprio papel.

## Implantação

A migração `0002_accounts.sql` cria tabelas adicionais sem substituir dados existentes. Ambas as migrações são idempotentes. A automação lê os arquivos SQL em ordem, habilita a compatibilidade Node necessária à criptografia somente na prévia e refaz somente o deployment correspondente ao commit de desenvolvimento. Preserva bindings existentes e confere a configuração e o deployment de produção.

O fluxo de integração remoto cria duas contas com domínio reservado `.invalid` e senha aleatória gerada no runner, sem registrar credenciais. Envia um anúncio pendente e verifica login, persistência, isolamento, restrição administrativa, idempotência, ausência no catálogo e logout. Um bloco finally remove somente essas contas temporárias e seus anúncios do banco isolado da prévia. Nunca promove contas nem publica ofertas nesse teste.

## Evidências e limites

A execução [42417972491](https://github.com/bacharelado/vendeplus/actions/runs/42417972491), commit b4d3364, concluiu cadastro, login, sessões, envio real ao D1, isolamento, revisão e limpeza na Cloudflare. A prévia validada foi https://04f6a919.vendeplus.pages.dev. Testes SQLite locais também executam o fluxo de revisão com uma conta privilegiada criada exclusivamente na memória do teste.

A primeira conta administradora ainda precisa ser escolhida pelo CEO. Recuperação de senha, confirmação de e-mail/telefone por códigos, envio de fotos, edição online e retomada de anúncios, denúncias, política de privacidade completa, exclusão de conta e ensaios de carga continuam necessários antes de abrir uma operação real. A versão principal não foi alterada nem recebeu estes recursos.
