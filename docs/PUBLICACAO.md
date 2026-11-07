# VENDE+ — Publicação da demonstração no Cloudflare Pages

**Estado:** apenas demonstração com dados fictícios. Não é um marketplace pronto para uso real.

## Pré-requisitos

- Repositório privado `bacharelado/vendeplus` com a branch `main`.
- Compilação local testada com `npm ci`, `npm test` e `npm run build`.
- Conta gratuita na Cloudflare. Não cadastrar cartão ou ativar planos pagos sem aprovação do fundador.

## Configuração no painel da Cloudflare

1. Acesse https://dash.cloudflare.com/ → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Autorize a integração GitHub para o repositório `bacharelado/vendeplus`.
3. Selecione o repositório e configure:
   - **Project name:** `vendeplus-demo` (ou outro nome disponível; muda o subdomínio).
   - **Production branch:** `main`.
   - **Framework preset:** React (Vite).
   - **Root directory:** raiz do repositório, `/`.
   - **Build command:** `npm run build`.
   - **Build output directory:** `dist`.
   - **Node version:** `22`, caso precise definir `NODE_VERSION=22`.
4. Escolha a opção gratuita e confirme a primeira publicação.
5. O painel mostrará o endereço real gerado (exemplo de formato: `https://NOME.pages.dev`). Não presuma um endereço antes do deploy.

## Rotina de trabalho

- Alterações novas entram em uma branch com pull request.
- Revisar a versão de prévia e testes antes de mesclar na `main`.
- Cloudflare publica automaticamente a `main` após o merge.
- No computador local, executar `git pull origin main` antes de continuar trabalhando.

## Cuidados

- O **repositório privado não torna o site da Cloudflare privado**. Qualquer pessoa com o endereço pode acessar a demonstração.
- A área `Admin` é uma SIMULAÇÃO aberta, sem autenticação; nunca inserir dados reais de vendedores.
- Não incluir chaves, credenciais, números reais de WhatsApp nem documentos pessoais.
- A autenticação, as regras de acesso e o banco de dados ainda não foram desenvolvidos para produção.
- Se o build falhar, consultar os logs do Cloudflare e corrigir o repositório antes de compartilhar o link.

Documentação oficial: https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/
