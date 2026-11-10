# VENDE+ 2.0 — APOCALYPTIC

Marketplace hiperlocal em desenvolvimento para Poranga I, Poranga II e Jacarezinho, Itacoatiara-AM.

## Situação

A branch feat/vendeplus-2.0 concentra a reformulação. A main e a produção não devem ser alteradas sem testes e autorização.

Em código: contas e sessões, catálogo D1, publicação automática de ofertas comuns, retenção simples de ofertas suspeitas, edição de anúncios próprios, perfil público, filtros por bairro, denúncias, indicadores administrativos e fotos opcionais via Cloudinary autenticado, com compatibilidade para imagens antigas no R2.

Regras simples de moderação não garantem identificar golpes. O VENDE+ não intermedeia pagamentos.

IA está desativada. O botão Anunciar abre o fluxo de publicação diretamente; os campos têm exemplos e textos simples. O catálogo permite carregar mais anúncios e consultar um anúncio antigo pelo próprio ID.

## Instalação

Node.js >= 22.12, Git e npm. Clone a branch feat/vendeplus-2.0 do repositório bacharelado/vendeplus, execute npm ci e npm run dev.

O Vite local não executa Pages Functions; para APIs completas use a prévia Cloudflare com bindings de teste.

## Cloudflare e banco de dados

MARKETPLACE_DB está configurado para o banco D1 vendeplus-preview somente no ambiente de prévia. Migrações 0001, 0002 e 0003 são incrementais; o workflow da branch 2.0 confere que a produção não muda.

LISTING_IMAGES é o binding R2 opcional. Crie um bucket separado para prévia e associe o binding ao ambiente Preview em Workers & Pages > projeto VENDE+ > Settings > Bindings > Add > R2 bucket. Faça redeploy. Sem R2, anúncios sem foto funcionam e upload retorna 503.

As fotos são convertidas pelo navegador para PNG, limitadas a 3 MB e 1280 pixels por dimensão. O servidor decodifica e reescreve a imagem, limita a conta a 10 tentativas em 15 minutos e limpa arquivos substituídos sem referências. Fotos continuam acessíveis apenas enquanto o anúncio estiver publicado. Falhas de limpeza são informadas; objetos órfãos históricos ainda precisam de revisão.

## Fotografias com Cloudinary gratuito

O armazenamento recomendado para novos uploads é o Cloudinary Image & Video API no plano Free (sem cartão, sujeito aos limites e termos vigentes). Não habilite plano pago. O D1 continua sendo o banco de anúncios. Se as credenciais do Cloudinary estiverem presentes, novos uploads usam Cloudinary; arquivos R2 existentes continuam servidos pelo seu binding original.

Configure em **Workers & Pages > vendeplus > Settings > Variables and Secrets** no ambiente **Preview** antes de produção:
- `CLOUDINARY_CLOUD_NAME`: nome do produto Cloudinary (variável)
- `CLOUDINARY_API_KEY`: chave da API (variável ou segredo)
- `CLOUDINARY_API_SECRET`: segredo da API (obrigatoriamente **Encrypt**)

Jamais coloque essas informações no GitHub, no código do navegador, em `VITE_*`, em prints ou neste chat. Não é necessário criar upload preset público. Faça novo deploy da prévia após configurar os valores. A rota `/api/media-upload` retorna `{"available":true}` somente quando há D1 e um provedor de fotos habilitado.

O servidor exige sessão de vendedor, propriedade do anúncio, origem válida e foto PNG reprocessada de até 3 MB. O upload é assinado no servidor, a imagem é armazenada como **authenticated** no Cloudinary, e a entrega passa por `/api/media/...` com verificação de anúncio publicado. A chave da API nunca chega ao navegador. Há controles de 10 tentativas a cada 15 minutos, no máximo 15 uploads por conta a cada 30 dias e no máximo 200 uploads totais a cada 30 dias para o Cloudinary.

O limite técnico de uploads não controla sozinho todos os créditos: visitantes também consomem banda de imagens. Monitore o painel Usage do Cloudinary e mantenha o plano gratuito. Fotos removidas/substituídas são excluídas quando possível; falhas de limpeza precisam de revisão. A configuração de produção exige testes em prévia e autorização explícita do CEO.

## Segurança

A conta admin é promovida fora do cadastro público. APIs exigem sessão, autorização do proprietário e verificação no servidor. Vendedores suspensos não têm sessão ativa e seus anúncios deixam de ser exibidos. Há limites de tentativas e de publicação no D1.

Pendências para operação real: recuperação de senha, verificação automática do contato, política de privacidade, testes de carga, monitoramento de abuso e contestação de denúncias.

## Testes

npm test
python3 tests/schema_test.py
npm run build
npm run test:e2e

Os testes remotos nunca devem publicar ofertas de demonstração no catálogo; contas temporárias e seus anúncios retidos são removidos após os testes.
