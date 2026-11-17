# VENDE+ — Cloudflare R2 e Images (ativação opcional)

Esta implementação **não migra fotos** e **não altera a produção automaticamente**.

## Estado padrão

- Sem `MEDIA_STORAGE_PROVIDER`, novos uploads continuam usando Cloudinary quando configurado; se não houver Cloudinary, o R2 existente continua disponível.
- Fotos existentes mantêm suas URLs e o sistema identifica o provedor pelo prefixo `c-`.
- `MEDIA_IMAGE_OPTIMIZATION` é desligado por padrão.
- A validação de login, propriedade do anúncio, rate limit, formato PNG e limite de tamanho foi preservada.

## Ativar o R2 (apenas depois de criar o bucket)

No painel **Workers & Pages → VENDE+ → Settings → Functions → R2 bucket bindings**, vincule um bucket com o nome de variável `LISTING_IMAGES` para o ambiente apropriado. Configure primeiro em **Preview**, com bucket distinto de Production.

Configure uma variável de texto (não secreta): `MEDIA_STORAGE_PROVIDER=r2`.

Quando essa variável estiver presente, o sistema exigirá o bucket. Se ele não existir, novas fotos retornarão indisponibilidade; **não haverá fallback silencioso para Cloudinary**.

**Importante:** mantenha o Cloudinary configurado se houver fotos antigas com prefixo `c-`, pois a leitura/exclusão delas ainda depende do provedor original. Não apague o bucket ou os arquivos existentes.

## Ativar a otimização Cloudflare Images

Este recurso é **opcional** e pode gerar consumo de transformações:

1. Confirme que um binding `IMAGES` é suportado e está disponível no runtime do projeto; configure-o conforme a documentação do seu ambiente.
2. Configure `MEDIA_IMAGE_OPTIMIZATION=enabled`.
3. Somente imagens guardadas em R2 serão transformadas: largura máxima alvo de 960 px e saída WebP, qualidade 80.
4. A rota `/api/media/*` mantém a autorização por anúncio publicado e vendedor não suspenso antes de ler o arquivo.
5. Sem binding `IMAGES`, a imagem PNG original continua sendo entregue. HEAD mantém a resposta original.

A resposta transformada informa `Content-Type: image/webp` mesmo com a URL pública histórica terminando em `.png`. Isso permite manter os links, mas consumidores externos que assumem formato pelo sufixo devem ser verificados antes de ativar.

Não habilitar sem primeiro validar o suporte do binding, as cotas, o formato e a operação em **Preview**. Requisições repetidas são `private, no-store`, de modo que esta versão **não implementa cache das transformações**; monitorar consumo antes de liberar em produção.

## Voltar atrás

Remover `MEDIA_STORAGE_PROVIDER` faz o upload voltar ao comportamento padrão; fotos R2 anteriores continuam acessíveis se `LISTING_IMAGES` permanecer vinculado. Remover `MEDIA_IMAGE_OPTIMIZATION` desliga novas transformações. Nunca desativar Cloudinary ou excluir bucket antigo até migrar/limpar com segurança.

Documentação:
- https://developers.cloudflare.com/pages/functions/bindings/
- https://developers.cloudflare.com/images/optimization/binding/
- https://developers.cloudflare.com/images/pricing/
