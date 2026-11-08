export function filterListings(listings, filters = {}) {
  const {category = 'Todas', condition = 'Todas', neighborhood = 'Todos', query = '', sortOrder = 'recentes'} = filters;
  const normalized = String(query).trim().toLocaleLowerCase('pt-BR');
  return listings
    .filter(listing => listing.status === 'PUBLICADO'
      && (category === 'Todas' || listing.category === category)
      && (condition === 'Todas' || listing.condition === condition)
      && (neighborhood === 'Todos' || listing.neighborhood === neighborhood)
      && `${listing.title} ${listing.description} ${listing.seller}`.toLocaleLowerCase('pt-BR').includes(normalized))
    .sort((a, b) => {
      if (sortOrder === 'menor') return (a.priceCents ?? Number.MAX_SAFE_INTEGER) - (b.priceCents ?? Number.MAX_SAFE_INTEGER);
      if (sortOrder === 'maior') return (b.priceCents ?? -1) - (a.priceCents ?? -1);
      return b.createdAt - a.createdAt || b.id - a.id;
    });
}

