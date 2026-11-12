# Melhorias da experiência — 12 de novembro de 2026

## Vitrine vazia
A consulta de contagens, executada em 12/11/2026, encontrou um anúncio em produção, marcado como removido, e zero anúncios públicos. A API pública respondeu com uma lista vazia. Na prévia, os dois registros estavam removidos. Nenhum anúncio foi restaurado, inventado ou transferido entre ambientes.

## Alterações
- Página inicial compacta: busca, categorias e anúncios, com convite para vender após a vitrine.
- Tela vazia permite iniciar uma publicação.
- Fotos maiores, preço destacado e contato direto nos cartões, sem links aninhados.
- Componente ContactLink compartilha a mensagem e o endereço correto do anúncio entre cartão e detalhe.
- Formulário com foto, título, preço, bairro, categoria, condição, descrição e entrega opcional. O contato vem da conta autenticada. A entrega vazia é enviada como combinação pelo WhatsApp.
- Validações de preço, descrição, condição e moderação permanecem ativas.
- Publicação confirmada oferece link para abrir o anúncio público; anúncios pendentes não recebem esse link.
- Perfil editável recolhido para reduzir distrações.
- Componentes Button, ActionLink e Field reutilizados em formulário e contato.
- Folha de estilo única organizada por componentes e responsividade, substituindo estilos antigos sobrepostos.

## Publicação
Fluxo autorizado pelo fundador: programar → publicar. O build da hospedagem precisa concluir para a nova versão ficar disponível. As automações previamente configuradas continuam ativas. Nenhuma conta, anúncio de demonstração ou mensagem a vendedor foi criada durante esta alteração.
