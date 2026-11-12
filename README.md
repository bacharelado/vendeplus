# VENDE+ — Marketplace de Poranga e Jacarezinho

Produto da APOCALYPTIC para aproximar compradores e vendedores de Poranga I, Poranga II e Jacarezinho, em Itacoatiara-AM. Os compradores exploram anúncios sem conta; os vendedores utilizam contas próprias e podem conversar com interessados diretamente pelo WhatsApp. **O VENDE+ não intermedeia pagamentos ou entregas.**

## Versão oficial e ambientes

- **Site oficial (Cloudflare Pages):** https://vendeplus.pages.dev/
- **Código oficial:** branch `main`, no repositório `bacharelado/vendeplus`.
- **Prévia:** branches e pull requests do Cloudflare Pages, com banco `vendeplus-preview` separado do banco de produção `vendeplus-production`.
- **Fluxo de atualização:** programar → publicar em `main` → Cloudflare Pages.
- O pipeline **Workers Builds** é separado do Pages e vem apresentando falha de configuração relacionada a `previews`. O sucesso de Pages não prova o sucesso de Workers Builds; não confundir os dois.
- Verificar o resultado da Cloudflare Pages após cada merge. Não alterar segredos, dados reais, migrar bancos ou contratar serviços por causa de um deploy.

## Arquitetura

| Camada | Tecnologia e responsabilidade |
| --- | --- |
| Interface | React, TypeScript, CSS, Vite; navegação adaptada a celular |
| Backend | Cloudflare Pages Functions em `functions/api` |
| Banco | Cloudflare D1/SQL; anúncios, contas, sessões, moderação e denúncias |
| Imagens | Cloudinary autenticado para novos uploads e compatibilidade com R2 para arquivos existentes quando configurado |
| Negociação | Link direto para o WhatsApp do vendedor, sem checkout |
| Qualidade | Node test, testes SQL, TypeScript/build e Playwright desktop/mobile |

### Principais caminhos

- `#inicio`: vitrine e busca inicial.
- `#catalogo`: catálogo público e filtros.
- `#anuncio-ID`: detalhes do anúncio e contato (links com fragmento; não são páginas HTML individualizadas para mecanismos de busca).
- `#anunciar`: entrada orientada para vender, com cadastro ou login e formulário de anúncio.
- `#conta`: acesso à conta e aos anúncios do vendedor.
- `#admin`: administração com autenticação e perfil autorizado.
- `#painel` e `#publicar`: rascunhos **locais ao navegador**, que não são anúncios públicos.

### APIs relevantes

- `GET /api/listings`: catálogo público, consulta por ID e paginação por cursor; resultados retornam até 200 itens por chamada.
- `/api/account/*`: cadastro, login, sessão, publicação, edição, pausa, reativação e administração conforme autorização.
- `GET/POST /api/media-upload`: disponibilidade e upload de imagens associado a anúncio do proprietário.
- `GET /api/media/*`: entrega de imagem apenas quando vinculada a anúncio publicado permitido.
- `GET /api/sellers/*`: perfil público e anúncios publicados.
- `POST /api/reports`: registro de denúncia.
- `POST /api/photo-analyze`: **desativado**. Não há preenchimento automático com IA no produto atual.

## Executar e testar

Requisitos: Git, Node.js 22.12+ e npm.

```bash
git clone https://github.com/bacharelado/vendeplus.git
cd vendeplus
npm ci
npm run dev
```

O servidor Vite local **não executa** Cloudflare Pages Functions; para fluxo completo com D1 e imagens, utilizar prévia isolada com bindings autorizados.

```bash
npm test
python3 tests/schema_test.py
npm run build
npm run test:e2e
```

Os testes devem evitar alterações em contas/anúncios reais. Testes de integração utilizam contas e identificadores técnicos, com limpeza dos registros temporários.

## Proteções e limites

- Senhas armazenadas com scrypt e sal individual; sessões aleatórias em cookies `HttpOnly`, `Secure` e `SameSite=Lax`.
- APIs de escrita verificam sessão, origem, propriedade do anúncio, tamanho dos pedidos e limites de requisição.
- O upload exige imagem válida, reprocessamento no servidor e controle de cotas; a imagem do anúncio pode ser removida quando deixar de estar referenciada.
- Anúncios comuns podem ser publicados automaticamente; um filtro simples sinaliza alguns conteúdos para revisão. **Isso não é verificação de vendedor, certificação antifraude ou garantia de negociação.**
- Cotas do piloto de Cloudinary: 10 tentativas a cada 15 minutos; 15 novos uploads por conta e 200 uploads globais a cada 30 dias. O uso de banda também gera consumo e deve ser acompanhado.

## Pendências abertas

1. Recuperação segura de senha por canal confiável, sem atalhos que permitam tomada de conta.
2. Verificação do controle do telefone/WhatsApp e política adequada para o estado de vendedor pendente.
3. Termos, política de privacidade, retenção e exclusão de dados em conformidade com as exigências aplicáveis.
4. Tratamento de denúncias, recurso de contestação, limites de abuso e autenticação forte para administração.
5. Testes de carga, monitoramento de saúde/custos, backup e recuperação.
6. Descoberta de anúncios em mecanismos de busca: as rotas por `#` não fornecem HTML individual indexável.
7. Estudo de fotos múltiplas sem ultrapassar os recursos gratuitos.
8. Testes observacionais com compradores e vendedores reais e indicadores de adoção.
9. Diagnóstico do Workers Builds separado para eliminar a falha persistente sem prejudicar o deploy de Pages.

## Regras de operação

Orçamento autorizado: **R$ 0**. Não ativar serviços pagos ou expor chaves do Cloudinary, tokens da Cloudflare ou dados pessoais em commits e relatórios. Usar o ciclo **programar → publicar**, conforme decisão do fundador em 12 de novembro de 2026. Os workflows automáticos existentes continuam configurados; testes reais exigem consentimento e escopo controlado.

Ver `docs/SEGURANCA.md`, `docs/DECISOES.md` e `docs/OPERACAO-PILOTO.md` para riscos e planejamento.
