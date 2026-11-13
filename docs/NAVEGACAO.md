# Navegação do VENDE+ — mapa oficial

O VENDE+ tem **sete tipos de página**, não dezoito páginas independentes. Os demais endereços são atalhos, rotas dinâmicas e links legados. A fonte única dos caminhos é `src/lib/routes.mjs`, com declarações TypeScript em `src/lib/routes.d.mts`. Testes em `tests/routes.test.mjs`.

| Página | Caminho principal | Finalidade |
|---|---|---|
| Início | `#inicio` | Vitrine, busca, categorias e explicação |
| Anúncio | `#anuncio-ID` | Detalhes do produto e contato |
| Vendedor | `#vendedor-UUID` | Perfil público e anúncios |
| Acesso | `#entrar` | Entrar e criar conta |
| Conta | `#area` | Meus anúncios, rascunhos e perfil |
| Publicar | `#publicar` | Cadastrar e editar anúncios |
| Administração | `#admin` | Área exclusiva de administradores autorizados |

## Atalhos e compatibilidade

- `#catalogo` abre as ofertas dentro de Início.
- `#como-funciona` abre o passo a passo de compras dentro de Início.
- `#painel` e `#conta` levam à Minha área.
- `#cadastro` abre a entrada já no modo de cadastro.
- `#anunciar` leva à publicação.
- `#editar-ID` abre um rascunho antigo no formulário atual.
- `#entrar?recuperar` abre o pedido de recuperação de senha.
- `#entrar?redefinir=TOKEN` abre a redefinição com o token do e-mail.
- `#publicar?rascunho=ID` e `#publicar?anuncio=ID` recuperam o item correspondente no formulário único.

Não remover nem redirecionar para links diferentes sem manter a compatibilidade: usuários podem ter anúncios e perfis compartilhados no WhatsApp. A aplicação usa URLs com `#`, evitando regras adicionais de reescrita no Cloudflare Pages.

## Critérios de navegação

- Cabeçalho: Ver anúncios, Minha área e Anunciar.
- Menu móvel: Início, Anunciar e Minha área.
- Administração só aparece como atalho dentro de uma sessão administradora; a API valida os privilégios de qualquer forma.
- Busca, categorias e instruções ficam dentro da página inicial, não exigindo páginas extras.
- `#como-funciona` deve rolar à seção com três passos, não ao aviso isolado.
- Rotas desconhecidas apresentam a página não encontrada com volta para o início.
- Ao entrar sem estar autenticado, o destino original de anúncio/rascunho a publicar é preservado para após o login.

Rascunhos antigos permanecem na chave `vendeplus:drafts:v1` no navegador. Fotos de rascunhos precisam ser selecionadas novamente. Nenhum dado do Cloudflare D1, conta, anúncio ou segredo é alterado pela organização de navegação.

## Verificação

Executar `npm test` e `npm run build` e verificar as rotas públicas e a navegação com Playwright. O teste de rotas cobre formatos principais, legados, edição, recuperação e destinos inválidos. Esta organização não modifica APIs ou migrações.
