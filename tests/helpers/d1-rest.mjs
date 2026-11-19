import {DatabaseSync} from 'node:sqlite';
export function d1Query(sqlite=new DatabaseSync(':memory:')){
 return (sql,params=[])=>{
  sqlite.exec('SAVEPOINT d1_request');
  try{
   const result=sql.split(';').map(s=>s.trim()).filter(Boolean).map(statement=>{
    const query=sqlite.prepare(statement);
    const results=query.all(...params);
    return {success:true,results};
   });
   sqlite.exec('RELEASE d1_request');
   return result;
  }catch(error){sqlite.exec('ROLLBACK TO d1_request; RELEASE d1_request');throw error}
 };
}
