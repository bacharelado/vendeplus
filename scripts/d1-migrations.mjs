import {readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const directory=new URL('../migrations/',import.meta.url);
export async function readMigrations(){
 const names=(await readdir(directory)).filter(name=>name.endsWith('.sql')).sort();
 return Promise.all(names.map(async name=>({name,sql:await readFile(new URL(name,directory),'utf8')})));
}

// Only additive, reviewed DDL belongs in this runner. Unknown SQL requires a new migration strategy.
function statements(migration){
 return migration.sql.split(';').map(s=>s.trim()).filter(Boolean).map(sql=>{
  if(/^PRAGMA foreign_keys=ON$/i.test(sql))return {kind:'pragma',sql};
  let m=/^CREATE (?:UNIQUE )?(TABLE|INDEX) IF NOT EXISTS (marketplace_\w+)\b/i.exec(sql);
  if(m)return {kind:m[1].toLowerCase(),name:m[2],sql};
  m=/^ALTER TABLE (marketplace_\w+) ADD COLUMN (\w+) (.+)$/is.exec(sql);
  if(m)return {kind:'column',name:m[1],column:m[2],definition:m[2]+' '+m[3],sql};
  throw Error('SQL não incremental em '+migration.name);
 });
}
export function validateMigrations(migrations){
 if(!Array.isArray(migrations)||!migrations.length)throw Error('Migrações ausentes.');
 return migrations.map((migration,i)=>{
  if(!/^\d{4}_[a-z0-9_]+\.sql$/.test(migration.name)||Number(migration.name.slice(0,4))!==i+1)throw Error('Sequência de migrações inválida.');
  const ddl=statements(migration);
  if(!ddl.length)throw Error('Migração vazia.');
  return {name:migration.name,ddl,checksum:createHash('sha256').update(migration.sql).digest('hex')};
 });
}
const normalize=sql=>sql.replace(/\s+/g,' ').replace(/\s*([(),=])\s*/g,'$1').trim();
function definitions(sql){
 // Commas inside CHECK, UNIQUE or a default expression do not separate columns.
 const body=sql.slice(sql.indexOf('(')+1,sql.lastIndexOf(')'));
 const parts=[];let start=0,depth=0,quoted=false;
 for(let i=0;i<body.length;i++){
  const ch=body[i];
  if(ch==="'")quoted=!quoted;
  if(quoted)continue;
  if(ch==='(')depth++;
  if(ch===')')depth--;
  if(ch===','&&depth===0){parts.push(normalize(body.slice(start,i)));start=i+1}
 }
 return [...parts,normalize(body.slice(start))];
}
function pending(steps,schema){
 return steps.filter(step=>{
  if(step.kind==='pragma')return false;
  const existing=schema.get(step.name);
  if(!existing)return true;
  let compatible;
  if(step.kind==='index'){
   compatible=existing.type==='index'&&normalize(existing.sql)===normalize(step.sql.replace(' IF NOT EXISTS',''));
  }else{
   const current=definitions(existing.sql);
   if(step.kind==='column'&&!current.some(def=>def.split(' ')[0]===step.column))return true;
   const required=step.kind==='column'?[normalize(step.definition)]:definitions(step.sql);
   compatible=existing.type==='table'&&required.every(def=>current.includes(def));
  }
  if(!compatible)throw Error('Esquema incompatível em '+step.name+(step.column?'.'+step.column:'')+'. Confira a cópia do banco.');
  return false;
 });
}
export async function applyMigrations(query,migrations){
 const plan=validateMigrations(migrations);
 async function execute(sql,params=[]){
  const result=await query(sql,params);
  if(!Array.isArray(result)||!result.length||result.some(r=>r.success!==true))throw Error('A migração não foi confirmada integralmente.');
  return result[0].results||[];
 }
 async function schema(){
  const rows=await execute("SELECT name,type,sql FROM sqlite_master WHERE name LIKE 'marketplace_%' AND sql IS NOT NULL");
  return new Map(rows.map(row=>[row.name,row]));
 }
 await execute('CREATE TABLE IF NOT EXISTS marketplace_schema_migrations(name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL DEFAULT(unixepoch()))');
 const ledger=await execute('SELECT name,checksum FROM marketplace_schema_migrations ORDER BY name');
 if(ledger.some(row=>!plan.some(p=>p.name===row.name&&p.checksum===row.checksum)))throw Error('Versão desconhecida ou checksum divergente no histórico D1.');
 let current=await schema();
 const applied=[];
 for(const version of plan){
  const todo=pending(version.ddl,current);
  if(ledger.some(row=>row.name===version.name)){
   if(todo.length)throw Error('O esquema diverge da versão registrada '+version.name);
   continue;
  }
  if(todo.length){
   try{await execute(todo.map(step=>step.sql+';').join('\n'))}
   catch(error){current=await schema();if(pending(version.ddl,current).length)throw error}
   current=await schema();
   if(pending(version.ddl,current).length)throw Error('Esquema incompleto após '+version.name);
  }
  await execute('INSERT INTO marketplace_schema_migrations(name,checksum) VALUES (?,?) ON CONFLICT(name) DO NOTHING',[version.name,version.checksum]);
  const [receipt]=await execute('SELECT checksum FROM marketplace_schema_migrations WHERE name=?',[version.name]);
  if(receipt?.checksum!==version.checksum)throw Error('Versão concorrente diferente em '+version.name);
  applied.push(version.name);
 }
 return applied;
}
