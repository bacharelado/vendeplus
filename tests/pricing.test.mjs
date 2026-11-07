import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBRL,formatBRL,classifyContent} from '../src/lib/pricing.mjs';

test('converte preços brasileiros',()=>{
  assert.deepEqual(parseBRL('25,90'),{ok:true,cents:2590});
  assert.deepEqual(parseBRL('1.250,00'),{ok:true,cents:125000});
  assert.equal(formatBRL(2590).includes('25,90'),true);
});
test('proíbe preços inválidos e negativos',()=>{
  for (const s of ['-5','0','abc','12.34','1,999','']) assert.equal(parseBRL(s).ok,false);
});
test('aceita serviço sob orçamento, mas não produto',()=>{
  assert.deepEqual(parseBRL('',true),{ok:true,cents:null});
  assert.equal(parseBRL('',false).ok,false);
});
test('classificação de demonstração',()=>{
  assert.equal(classifyContent('Compre meu fogão'),'PUBLICADO');
  assert.equal(classifyContent('Pagamento antecipado'),'EM_ANALISE');
  assert.equal(classifyContent('Vendo vape'),'BLOQUEADO');
});
