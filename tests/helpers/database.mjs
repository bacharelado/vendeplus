import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function database(){
 const sqlite=new DatabaseSync(':memory:');
 for(const name of ['0001_marketplace','0002_accounts','0003_vendeplus_2'])sqlite.exec(readFileSync(new URL('../../migrations/'+name+'.sql',import.meta.url),'utf8'));
 const db={prepare(sql){let values=[];const statement={bind(...args){values=args;return statement},async first(){return sqlite.prepare(sql).get(...values)||null},async all(){return {success:true,results:sqlite.prepare(sql).all(...values)}},async run(){return {meta:sqlite.prepare(sql).run(...values)}}};return statement},async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result}catch(error){sqlite.exec('ROLLBACK');throw error}}};
 return {db,sqlite};
}
