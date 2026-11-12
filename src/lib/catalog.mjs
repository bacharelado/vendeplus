export function filterListings(listings, filters = {}) {
  const {category = 'Todas', condition = 'Todas', neighborhood = 'Todos', query = '', sortOrder = 'recentes'} = filters;
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const normalized = normalize(query).trim();
  return listings
    .filter(listing => listing.status === 'PUBLICADO'
      && (category === 'Todas' || listing.category === category)
      && (condition === 'Todas' || listing.condition === condition)
      && (neighborhood === 'Todos' || listing.neighborhood === neighborhood)
      && normalize(`${listing.title} ${listing.description} ${listing.seller}`).includes(normalized))
    .sort((a, b) => {
      if (sortOrder === 'menor') return (a.priceCents ?? Number.MAX_SAFE_INTEGER) - (b.priceCents ?? Number.MAX_SAFE_INTEGER);
      if (sortOrder === 'maior') return (b.priceCents ?? -1) - (a.priceCents ?? -1);
      return (b.createdAt ?? b.id) - (a.createdAt ?? a.id) || b.id - a.id;
    });
}

