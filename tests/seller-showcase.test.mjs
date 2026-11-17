import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readRoute} from '../src/lib/routes.mjs';

test('rota publica aceita UUID e @slug amigavel',()=>{
 assert.equal(readRoute('#vendedor-loja-do-bairro').sellerId,'loja-do-bairro');
 assert.equal(readRoute('#vendedor-123e4567-e89b-12d3-a456-426614174000').name,'vendedor');
 assert.equal(readRoute('#vendedor-../admin').name,'indisponivel');
});

test('migration da vitrine protege slug e cria fila de denuncias',async()=>{
 const sql=await readFile(new URL('../migrations/0005_seller_showcase.sql',import.meta.url),'utf8');
 assert.match(sql,/UNIQUE INDEX[\s\S]*slug/i);
 assert.match(sql,/marketplace_seller_reports/);
 assert.match(sql,/seller_type/);
});

test('perfil publico nao seleciona email ou credenciais',async()=>{
 const source=await readFile(new URL('../functions/api/sellers/[[path]].ts',import.meta.url),'utf8');
 assert.doesNotMatch(source,/password_hash|marketplace_sessions/);
 assert.doesNotMatch(source,/a\.email/);
 assert.match(source,/s\.status!='suspended'/);
 assert.match(source,/l\.status='published'/);
});
