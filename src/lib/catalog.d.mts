import type {Listing} from '../data/marketplace';
export type CatalogFilters = {
  category?: string;
  condition?: string;
  query?: string;
  sortOrder?: 'recentes' | 'menor' | 'maior';
};
export declare function filterListings(listings: Listing[], filters?: CatalogFilters): Listing[];

