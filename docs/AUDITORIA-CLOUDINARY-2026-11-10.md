# VENDE+ — Correção de fotos e verificação de publicação

Auditoria autorizada pela APOCALYPTIC em 10/11/2026, horário de Itacoatiara.

**Situação: fotos corrigidas e validadas na prévia; publicação oficial bloqueada por credenciais ausentes em Production. A autorização do CEO já foi recebida. Nenhum merge foi feito para evitar uma publicação incompleta.**

## Correção e causa

O upload usava `/image/authenticated` como endpoint da API. A chamada foi corrigida para `/image/upload`, com `type=authenticated` no formulário e na assinatura. A entrega continua autenticada no Cloudinary, mediada pelo servidor e permitida somente para anúncios publicados de vendedores não suspensos.

Os testes antigos validavam o mesmo endpoint incorreto; foram corrigidos e ampliados para rejeitar respostas públicas, identificadores divergentes e falhas do provedor. O servidor agora registra fase, status/categoria do provedor e identificador de correlação sem imprimir chaves, assinaturas ou respostas sensíveis.

A remoção pelo proprietário agora também exclui a imagem do armazenamento, depois de retirar o anúncio da vitrine e conferir referências. Falhas de limpeza geram aviso sem fingir que o anúncio continua publicado. A interface confirma explicitamente a remoção. As imagens na vitrine e nos detalhes passaram a usar enquadramento integral, preservando as bordas e os textos da foto de produto; o corte encontrado na revisão visual foi corrigido e verificado em nova auditoria real.

## Validação executada

Código funcional validado: `ffd3bbfb03ea3cef8bd4879d4502fc0397a51db6`.

Prévia real: https://cc69c817.vendeplus.pages.dev

| Verificação | Resultado |
|---|---|
| Testes Node/API/segurança | 80 aprovados, nenhum ignorado |
| Verificações SQL | 4 aprovadas |
| TypeScript e build Vite | Aprovados |
| Interface Playwright | 42 cenários aprovados, computador e celular |
| Auditoria npm | Nenhuma vulnerabilidade reportada, incluindo dependências de desenvolvimento |
| Cadastro real | Duas contas QA, e-mails únicos `example.invalid`, telefone fictício com zeros, sem contatos de terceiros |
| Login, sessão e logout | Aprovados, cookies HttpOnly/Secure |
| Publicação e edição | Persistência no D1 e catálogo público confirmadas |
| Upload de PNG técnico | HTTP 200, PNG de 320 × 240, pixels entregues idênticos aos enviados |
| Imagem de produto anexada pelo CEO | Fixture JPEG reduzida para teste; seleção pelo formulário real, conversão pelo navegador para PNG, upload HTTP 200 e imagem visível em 1280 × 853 no celular |
| Exibição pública | Confirmada em navegador desktop e mobile, com captura de evidências |
| Isolamento entre vendedores | Upload e alteração de anúncio alheio retornam 404; área administrativa retorna 403 para vendedor |
| Pausa/reativação | Foto retorna 404 enquanto pausado e 200 após reativação |
| Exclusão | Anúncio retirado do catálogo e exclusão da fotografia confirmada |
| Limpeza QA | Contas, anúncios, sessões e registros temporários removidos; nenhum usuário real alterado |

Auditoria real final: [GitHub Actions 42955354863](https://github.com/bacharelado/vendeplus/actions/runs/42955354863). O artefato desse run contém `report.json` e capturas desktop/mobile, incluindo `product-mobile.png`. Retenção do artefato: 7 dias.

Na primeira execução após a correção, o upload já retornou 200 e a comparação dos pixels passou, mas uma asserção visual não aguardava o carregamento da imagem. O teste passou a esperar a decodificação; a auditoria completa e a repetição com fotografia de produto foram aprovadas. Todas as tentativas removeram seus dados QA.

## Banco e segurança

`vendeplus-preview` e `vendeplus-production` são bancos distintos, ambos com as tabelas esperadas e `nodejs_compat` configurado. `PRAGMA quick_check` retornou `ok` nos dois; `PRAGMA foreign_key_check` não encontrou violações. Nenhuma migração nem mudança em registros reais foi executada.

Permanecem as verificações de origem, sessão, propriedade, tamanho/dimensões, decodificação e reescrita de PNG, CRC e limites de tentativas. Os testes verificaram esses controles. Os resultados não equivalem a certificação ou auditoria exaustiva de segurança.

Não houve contratação de plano pago. Permanecem os limites de piloto: 10 tentativas/15 minutos, 15 uploads por vendedor/30 dias e 200 uploads globais/30 dias. Banda de entrega também consome créditos Cloudinary e precisa de monitoramento; o limite de uploads não garante sozinho o consumo total.

## Workers Builds

O build `d32e5828-17df-49f4-a540-66175afee083` parou no comando de deploy. Os registros confirmaram:

> Your Wrangler configuration is missing a `previews` block to run this command.

O Cloudflare Pages publicou normalmente. O pipeline separado de Workers espera configuração de previews que não existe no repositório. Ele permanece pendente; não foi criado um segundo modo de hospedagem nem alterada a configuração de um Worker sem validação. A correção operacional é revisar o comando/integração desse serviço separado ou consolidar o deploy em Pages, conforme o uso efetivo do Worker.

## Limpeza de deploys

Após aprovação da auditoria real, foram removidos **14 deploys antigos de Preview** da branch `feat/cloudinary-fotos-free`, anteriores à prévia original desta missão. Antes de cada remoção, foram conferidas referências às URLs de imagens em todos os D1 vinculados, além do ambiente e do estado do deploy. Nenhuma exclusão usou `force`.

Foram preservados todos os deploys de Production, a prévia original `5165922d`, a prévia validada `91cb635f` e as prévias posteriores, inclusive `fb52e215`. O deploy oficial permaneceu `87925929-cfab-49e3-aa30-1f3188b8f41b`, e suas configurações permaneceram idênticas antes/depois.

[Execução da limpeza](https://github.com/bacharelado/vendeplus/actions/runs/42954954423). Uma primeira tentativa foi recusada pela paginação da API antes de excluir qualquer deploy; a paginação foi corrigida e a execução posterior terminou com sucesso.

## Impedimento para publicar

O ambiente Production não tem `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET`. As duas chaves da prévia são secretas e não podem ser lidas pela API para copiar à produção; tampouco estão disponíveis como segredos do repositório.

É necessário inserir essas variáveis diretamente em **Cloudflare Pages → vendeplus → Settings → Variables and Secrets → Production**, mantendo API key e secret criptografados. Não enviar credenciais em chat, commits ou relatórios.

O endereço oficial https://vendeplus.pages.dev/ foi verificado em leitura: a vitrine carregou, mas `/api/media-upload` retornou `{"available":false}`. Portanto, **não houve merge nem nova publicação oficial**, seguindo a instrução de não executar etapas que não possam ser validadas.

Depois de configurar Production: conferir novamente os bindings e as variáveis sem mostrar valores, mesclar o PR validado, aguardar Cloudflare Pages, verificar catálogo e foto com dados QA próprios, limpar o teste e confirmar recuperação pela versão oficial anterior. A autorização de publicação já está registrada; falta a configuração técnica.

Recuperação de senha e verificação de contatos continuam limitações conhecidas, anteriores a esta correção. Não foram declaradas como concluídas.
