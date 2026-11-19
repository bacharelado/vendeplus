import {DatabaseSync} from 'node:sqlite';
import {readdirSync,readFileSync} from 'node:fs';
export function database(){
 const sqlite=new DatabaseSync(':memory:');
 const migrations=new URL('../../migrations/',import.meta.url);
 for(const name of readdirSync(migrations).filter(n=>n.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL(name,migrations),'utf8'));
 const db={prepare(sql){let values=[];const statement={bind(...args){values=args;return statement},async first(){return sqlite.prepare(sql).get(...values)||null},async all(){return {success:true,results:sqlite.prepare(sql).all(...values)}},async run(){return {meta:sqlite.prepare(sql).run(...values)}}};return statement},async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result}catch(error){sqlite.exec('ROLLBACK');throw error}}};
 return {db,sqlite};
}
