import type {Draft} from '../data/marketplace';
export declare function validDraft(value:unknown):value is Draft;
export declare function readDrafts(storage:Pick<Storage,'getItem'>):Draft[];
export declare function writeDrafts(storage:Pick<Storage,'setItem'>,drafts:Draft[]):void;
