# Contas e envio online na prévia

## Comportamento

Visitantes exploram o catálogo sem cadastro. Moradores e comerciantes de Poranga I, Poranga II e Jacarezinho podem criar uma conta em `#cadastro`, entrar em `#conta` e enviar ofertas ao banco. O rótulo público da região é Poranga e Jacarezinho.

Os rascunhos continuam locais e podem ser enviados pelo botão Enviar online. Antes do envio, o vendedor confere os dados e escolhe o bairro da oferta. Um envio confirmado fica no D1, aparece na área do proprietário e permanece disponível ao entrar em outro aparelho. Somente cadastro aprovado e anúncio publicado aparecem na consulta pública. O envio não equivale à publicação.

O WhatsApp aceita números com DDD, com ou sem +55 e com espaços, parênteses ou hífen. Interface e servidor usam a mesma normalização, salvando somente os dígitos no formato internacional brasileiro. Essa normalização não confirma que o telefone existe ou pertence ao usuário.

A autenticação usa senha de 8 a 128 caracteres, scrypt com salt individual, sessão aleatória de 256 bits e cookie `__Host-vendeplus`, HttpOnly, Secure, SameSite=Lax, válido por sete dias. O banco guarda somente o hash da sessão. Logout remove a sessão no servidor; sessões expiradas ou de vendedores suspensos não autorizam operações. Não há credencial no armazenamento local.

As escritas exigem origem idêntica e JSON, têm limite de corpo e usam parâmetros SQL. Os limites de tentativas de acesso e de envio ficam no D1. As chaves de limitação não armazenam IP/e-mail em texto. Cada consulta e alteração de vendedor confere o proprietário no servidor; a API ignora privilégios e status enviados no cadastro. A repetição de uma solicitação de envio com o mesmo identificador não cria outro anúncio.

O vendedor pode retirar suas ofertas, pausar um anúncio publicado ou marcá-lo vendido. A interface atual não oferece edição online nem retomada de anúncio pausado: um novo conteúdo passa por nova revisão. As alterações de status passam a valer na consulta pública; a navegação para o catálogo atualiza os dados.

## Revisão

`#admin` exige sessão administrativa. Uma conta comum recebe 403 da API, inclusive se tentar chamar os endpoints diretamente. A administração pode conferir o contato, registrar a aprovação do vendedor, aprovar ou rejeitar o anúncio. O vendedor envia à equipe pelo WhatsApp cadastrado o código privado mostrado em Minha área. Aprovar manualmente uma oferta sinalizada exige um vendedor com contato confirmado. Ofertas comuns continuam com publicação automática. As decisões possuem registro de autor e data no D1.

Nenhuma conta administrativa foi criada, promovida ou escolhida em nome do CEO. Para ativar a operação, o responsável deve criar a própria conta, indicar o identificador a ser autorizado e confirmar a promoção. A alteração deve ocorrer no banco da prévia, por um operador com acesso confiável, conferindo o identificador e o e-mail antes de atribuir `role='admin'`. Não existe endpoint de autopromoção, senha padrão ou opção de escolher o próprio papel.

## Implantação

Os preparadores da prévia e de produção conferem nomes e IDs de D1 e usam o mesmo histórico por banco. O executor compara as tabelas, colunas e índices legados com as migrações revisadas, completa a 0005 parcial e registra nome e checksum depois de conferir o esquema. Divergências interrompem a operação. A liberação está descrita no [plano do piloto](OPERACAO-PILOTO.md#liberação-acompanhada-no-poranga-ii).

O fluxo de integração remoto cria duas contas com domínio reservado `.invalid` e senha aleatória gerada no runner, sem registrar credenciais. Envia um anúncio pendente e verifica login, persistência, isolamento, restrição administrativa, idempotência, ausência no catálogo e logout. Um bloco finally remove somente essas contas temporárias e seus anúncios do banco isolado da prévia. Nunca promove contas nem publica ofertas nesse teste.

## Evidências e limites

A execução [42417972491](https://github.com/bacharelado/vendeplus/actions/runs/42417972491), commit b4d3364, concluiu cadastro, login, sessões, envio real ao D1, isolamento, revisão e limpeza na Cloudflare. A prévia validada foi https://04f6a919.vendeplus.pages.dev. Testes SQLite locais também executam o fluxo de revisão com uma conta privilegiada criada exclusivamente na memória do teste.

A escolha do administrador e os testes com moradores são decisões operacionais do responsável pelo piloto. Recuperação assistida de conta, política de privacidade completa, exclusão de conta e ensaios de carga continuam no planejamento.
