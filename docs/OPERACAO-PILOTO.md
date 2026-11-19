# VENDE+ — Plano de operação do piloto hiperlocal

**Escopo:** Poranga I, Poranga II e Jacarezinho, Itacoatiara-AM. **Orçamento:** R$ 0. **Produto:** vitrine para encontrar ofertas e falar diretamente no WhatsApp de quem anuncia. O VENDE+ não recebe pagamentos, não garante negociação e não é serviço de entrega.

Este documento é uma proposta operacional. **Metas não são resultados já alcançados.** Qualquer contato com moradores e estabelecimentos precisa de consentimento, respeito às regras dos grupos e ausência de divulgação de dados sem autorização.

## Princípio de lançamento

O maior risco não é falta de recursos sofisticados, mas uma vitrine vazia. Priorizar ofertas reais e vendedores que consigam responder ao contato. Não criar anúncios fictícios para dar impressão de movimento.

### Liberação acompanhada no Poranga II

1. Engenharia registra o SHA do PR, os resultados de Qualidade e Playwright e a evidência de “Fotos reais na prévia”. A prévia deve corresponder ao SHA e usar o D1 exclusivo `vendeplus-preview`. O ensaio repete as migrações, usa contas temporárias, verifica o destino do WhatsApp sem abrir conversa e remove as contas e fotos de teste.
2. Em um celular do piloto, publicar uma oferta com foto. Abrir a mesma oferta em um segundo dispositivo, conferir foto, valor, vendedor e conversa preparada. Pausar a oferta e confirmar que a foto pública e o botão de contato ficaram indisponíveis. Conferir a foto do anúncio pausado na conta do dono.
3. A equipe recebe no WhatsApp de suporte o código gerado em **Minha área → Meu WhatsApp**. Conferir os dígitos do remetente na conversa original e a conta correta. Inserir o código em **Gestão de vendedores**. Aceitar somente o código de contato da VENDE+ recebido do número mostrado, sem usar imagem de conversa encaminhada. Trocar o número exige nova confirmação. Registrar a opção de contato na vitrine do próprio vendedor. Essa opção começa desligada inclusive nas contas existentes. Revisões antigas preservam seu histórico, mas não identificam qual telefone foi conferido.
4. Uma pessoa da equipe acompanha a fila de anúncios e perfis. Enviar uma denúncia na prévia, conferir o contador, decidir e localizar a decisão, responsável e horário no histórico.
5. Antes da liberação oficial, configurar o projeto Pages com produção na `main`, comando `npm run build` e variável `VENDEPLUS_APPROVED_PRODUCTION_SHA` exclusivamente em produção. Deixá-la vazia até a revisão. Desabilitar implantações automáticas de produção nas configurações de branches, mantendo as prévias. Proteger a `main` com os checks de Qualidade e Playwright.
6. Em uma janela autorizada, conferir o ponto de recuperação ou exportação do D1 de produção e os IDs distintos nos bindings. Após o merge revisado, aguardar os dois jobs de **push na main** para o SHA final. Executar manualmente “Preparar publicação autorizada” em `main` informando esse SHA. Aplicar novamente para confirmar o histórico. Autorizar esse mesmo SHA no Pages e acionar manualmente o deploy hook privado da `main`. O build verifica o SHA recebido do Pages e os dois jobs do GitHub. Se a ponta da branch tiver avançado, o build fica bloqueado. Conferir o hash do deploy canônico. Em caso de falha, manter a versão anterior e corrigir em prévia.
7. Combinar com **cinco vendedores do Poranga II** a publicação de ofertas atuais. Cada um confirma o próprio número e quem pode abrir o contato. Divulgar os links das ofertas depois do aceite em dois dispositivos. Acompanhar quantos conseguem publicar sem ajuda.

O teste “Fotos reais na prévia” pode ser executado manualmente a partir da `main` revisada informando a branch e o SHA da prévia. No fluxo dessa correção também roda no push da branch do piloto. O teste confere o ambiente e o binding antes de tocar em dados QA. Os limites gratuitos do Cloudinary continuam valendo.

### Ciclo proposto de quatro semanas

| Semana | Atividade | Critério de conclusão |
| --- | --- | --- |
| 1 | Conversar com até 10 comerciantes ou moradores interessados; observar 3 tentativas de cadastro e publicação | Anotações sobre o que dificultou o uso, sem gravar senhas/dados privados |
| 2 | Ajudar vendedores interessados a publicar ofertas reais, com fotos autorizadas e informações completas | Primeiros anúncios verdadeiros e autorização para divulgação |
| 3 | Compartilhar links individuais em canais que permitam divulgação; pedir opinião a compradores que aceitarem | Medir quais canais geram visitas/contatos, sem confundir clique com venda |
| 4 | Rever anúncios, erros, dúvidas e relatos de vendedores; corrigir os três obstáculos mais frequentes | Relatório com números observados, problemas e próxima decisão |

**Metas iniciais ilustrativas:** 10 vendedores interessados, 20 anúncios publicados e 30 cliques de contato ao longo de um ciclo. Ajustar depois de obter a linha de base; não apresentar os números como previsão de vendas.

## Roteiro de pesquisa de experiência

Com permissão, observar a pessoa no próprio dispositivo, sem orientar a navegação:

1. “Procure um produto ou serviço que possa encontrar no bairro.”
2. “Abra uma oferta e encontre como falar com quem vende.”
3. Para quem deseja anunciar: “Crie sua conta e encontre o formulário do seu anúncio.”
4. “Descubra como editar ou encerrar um anúncio.”
5. “O que deixou você confuso? O que faria você voltar?”

Registrar apenas tempo aproximado, conclusão da tarefa e erros de interface; não coletar senhas, documentos, endereço residencial, mensagens privadas, áudios ou conteúdo de negociação.

## Mensagens sugeridas para divulgação

### Convite a vendedor, com contato individual autorizado

> Olá! Estamos desenvolvendo o VENDE+, uma vitrine de produtos e serviços de Poranga e Jacarezinho. Os anúncios podem ser encontrados por pessoas do bairro, que conversam diretamente com o vendedor pelo WhatsApp. A participação no piloto é gratuita. Se tiver interesse, posso mostrar como funciona e ouvir sua opinião.

### Divulgação de uma oferta real, com autorização

> Encontrou o que procurava no bairro? Confira esta oferta no VENDE+: [link do anúncio]. Fale diretamente com o vendedor e combine condições antes de pagar. O VENDE+ não recebe pagamentos.

Não prometer vendas, verificação de contatos, entrega ou proteção contra golpes que não foram de fato oferecidas.

## Indicadores mínimos

- **Vendedores interessados:** quantidade que aceitou avaliar ou utilizar a plataforma.
- **Vendedores ativos:** vendedores com ao menos um anúncio publicado não removido.
- **Anúncios reais publicados:** registros públicos no D1; excluem rascunhos e material de teste.
- **Tarefas concluídas:** compradores que conseguiram buscar e acessar contato; vendedores que conseguiram publicar sem ajuda.
- **Cliques de contato:** *se houver instrumento legítimo e consentido de medição*; não interpretar como venda.
- **Incidentes e denúncias:** receber, avaliar e encaminhar sem expor identidade dos envolvidos.
- **Custo e cotas:** acompanhar uso de Cloudflare e Cloudinary, sem ativar planos pagos.

Nenhuma telemetria adicional foi implementada por este documento. Caso sejam adicionadas métricas, avaliar privacidade, transparência e minimização de dados antes da coleta.

## Critérios de continuidade e freios

Prosseguir apenas com anúncio real, origem autorizada, conteúdo permitido e contato próprio do vendedor. Pausar crescimento e investigar se surgirem denúncias graves, falhas de autenticação, vazamento de dados, fotos acessíveis após remoção, problemas nas cotas ou cobrança inesperada.

## Reunião de encerramento semanal

Registrar: atividades efetivamente realizadas, número de ofertas reais, dificuldades de compradores e vendedores, incidentes pendentes, uso de cotas, resultados dos testes e decisões do CEO. Não transformar objetivos futuros em resultados concluídos.
