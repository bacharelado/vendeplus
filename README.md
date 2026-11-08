# VENDE+ 2.0 — APOCALYPTIC

Marketplace hiperlocal em desenvolvimento para Poranga I, Poranga II e Jacarezinho, Itacoatiara-AM.

## Situação

A branch feat/vendeplus-2.0 concentra a reformulação. A main e a produção não devem ser alteradas sem testes e autorização.

Em código: contas e sessões, catálogo D1, publicação automática de ofertas comuns, retenção simples de ofertas suspeitas, edição de anúncios próprios, perfil público, filtros por bairro, denúncias, indicadores administrativos e fotos opcionais via R2.

Regras simples de moderação não garantem identificar golpes. O VENDE+ não intermedeia pagamentos.

## Instalação

Node.js >= 22.12, Git e npm. Clone a branch feat/vendeplus-2.0 do repositório bacharelado/vendeplus, execute npm ci e npm run dev.

O Vite local não executa Pages Functions; para APIs completas use a prévia Cloudflare com bindings de teste.

## Cloudflare e banco de dados

MARKETPLACE_DB está configurado para o banco D1 vendeplus-preview somente no ambiente de prévia. Migrações 0001, 0002 e 0003 são incrementais; o workflow da branch 2.0 confere que a produção não muda.

LISTING_IMAGES é o binding R2 opcional. Crie um bucket separado para prévia e associe o binding ao ambiente Preview em Workers & Pages > projeto VENDE+ > Settings > Bindings > Add > R2 bucket. Faça redeploy. Sem R2, anúncios sem foto funcionam e upload retorna 503.

As fotos são convertidas pelo navegador para WebP antes do envio, limitadas a 3 MB pela API e acessíveis enquanto publicadas.

## Segurança

A conta admin é promovida fora do cadastro público. APIs exigem sessão, autorização do proprietário e verificação no servidor. Vendedores suspensos não têm sessão ativa e seus anúncios deixam de ser exibidos. Há limites de tentativas e de publicação no D1.

Pendências para operação real: recuperação de senha, verificação automática do contato, política de privacidade, testes de carga, monitoramento de abuso e contestação de denúncias.

## Testes

npm test
python3 tests/schema_test.py
npm run build
npm run test:e2e

Os testes remotos nunca devem publicar ofertas de demonstração no catálogo; contas temporárias e seus anúncios retidos são removidos após os testes.
