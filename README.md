# VENDE+ — Fundação do Software (Fase 1)

**APOCALYPTIC · piloto Poranga II, Itacoatiara-AM**

Este pacote é o **código-fonte de uma demonstração local em React + Vite + TypeScript**. Todas as pessoas, produtos e indicadores são fictícios. Nenhum dado persiste ao recarregar. Não há autenticação, servidor de aplicação, banco, pagamento, WhatsApp real ou painel administrativo protegido.

## Abrir no Windows 10

1. Instale **Node.js 22.12+** (ou versão 20.19+) e confirme no Prompt de Comando:
   ```bat
   node -v
   npm -v
   ```
2. Extraia este ZIP para uma pasta, por exemplo `C:\Users\helio\Desktop\vendeplus-fase1`.
3. No terminal aberto **dentro da pasta do projeto**, execute:
   ```bat
   npm install
   npm run dev
   ```
4. Abra **http://localhost:5173**.

Alternativa: dê dois cliques em `scripts\iniciar-windows.bat` após extrair a pasta. O `npm install` exige conexão com a internet, mas os pacotes são gratuitos.

### Outros comandos
```bat
npm run test
npm run typecheck
npm run build
```

`npm run build` gera uma versão estática em `dist/`; isso **não autoriza** publicar para clientes reais.

## Organização
```
src/
  components/ListingCard.tsx   cartão reutilizável
  data/mock.ts                anúncios e tipos fictícios
  lib/pricing.mjs             preço e filtros simples de demonstração
  lib/pricing.d.mts           tipagem do módulo JS
  styles/app.css              identidade visual
  App.tsx                     telas e navegação com hash
  main.tsx                    ponto de entrada
referencia/prototipo-v1.3.html  artefato de Claude preservado
scripts/iniciar-windows.bat     atalho opcional
```

## Limitações importantes
- Os filtros de palavras e estados são **apenas demonstrações de interface**; podem falhar e não são controles ant fraude.
- A navegação "Ver como: Admin" é livre justamente por se tratar de demo; não a use em produção.
- Não insira dados pessoais reais nesta aplicação.
- Nenhuma senha, API key, token ou número real de vendedor deve ser inserido no código.
- O nome **VENDE+** é de trabalho e pode ter conflitos marcários; verificar antes de divulgação comercial.
- Na Fase 2, operações sensíveis passarão por funções de servidor e RLS, com revisão de LGPD e testes.

## Verificação nesta entrega
- `npm run test` executa testes locais de preços e classificação por Node.
- Esta entrega foi gerada em ambiente isolado sem acesso ao registro do npm. Portanto a instalação das dependências, build Vite e a interface React devem ser validadas no seu PC após o `npm install`.

## Decisões vigentes
D1: confirmação manual do WhatsApp de vendedores; D2: regulamento v0.1 como base, revisão jurídica antes do público; D3: vínculo declarado com Poranga II; D4: orçamento R$ 0, nenhuma assinatura; D5: VENDE+ nome de trabalho, investigação da marca pendente.

## Próximas etapas (ainda não implementadas)
1. Validar instalação e compilação no Windows.
2. Migrar/modularizar toda a funcionalidade do protótipo v1.3, com testes de UI.
3. Planejar e implementar autenticação real, autorização e banco Supabase (plano gratuito) em ambiente isolado.
4. Criar upload seguro de imagens, denúncias com evidências, auditoria e moderação verificável no servidor.
5. Validar com moradores/comerciantes; revisar questões legais e custos antes de qualquer lançamento real.
