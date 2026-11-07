export type ParseResult = {ok:true; cents:number|null} | {ok:false; error:string};
export declare function parseBRL(raw: unknown, isService?: boolean): ParseResult;
export declare function formatBRL(cents: number|null): string;
export declare function classifyContent(text: string): 'PUBLICADO'|'EM_ANALISE'|'BLOQUEADO';
