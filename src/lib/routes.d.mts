export type RouteName = 'inicio'|'anuncio'|'vendedor'|'entrar'|'area'|'publicar'|'admin'|'indisponivel';
export interface Route {
  name: RouteName;
  id?: number;
  draftId?: string;
  sellerId?: string;
  editId?: number;
  section?: string;
  recover?: boolean;
  resetToken?: string;
}
export const ROUTES: Readonly<{
  home: string; catalog: string; howItWorks: string;
  login: string; register: string; recovery: string;
  account: string; publish: string; admin: string;
}>;
export const MOBILE_NAV: ReadonlyArray<Readonly<{id:'inicio'|'publicar'|'area';label:string;icon:string;href:string}>>;
export function listingHref(id:number):string;
export function sellerHref(id:string):string;
export function publishDraftHref(id:string):string;
export function publishEditHref(id:number):string;
export function readRoute(rawHash?:string):Route;
