import test from 'node:test';
import assert from 'node:assert/strict';
import {readDrafts,writeDrafts} from '../src/lib/drafts.mjs';
const draft={id:'draft-1',title:'Produto para teste',description:'Descrição usada apenas pelo teste automatizado.',priceCents:1500,category:'Casa',condition:'Usado',fulfillment:'Retirada combinada',updatedAt:Date.now()};
function storage(){const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)}}
test('rascunhos persistem entre leituras sem virar anúncios públicos',()=>{const memory=storage();writeDrafts(memory,[draft]);assert.deepEqual(readDrafts(memory),[draft]);assert.equal(readDrafts(memory)[0].status,undefined)});
test('armazenamento corrompido ou bloqueado não derruba leitura',()=>{assert.deepEqual(readDrafts({getItem:()=>'{'}),[]);assert.deepEqual(readDrafts({getItem:()=>{throw Error('bloqueado')}}),[])});
test('valida conteúdo e preços ao salvar e ler',()=>{const memory=storage();assert.throws(()=>writeDrafts(memory,[{...draft,title:'     '}]));assert.throws(()=>writeDrafts(memory,[{...draft,priceCents:0}]));assert.throws(()=>writeDrafts(memory,[{...draft,category:'Desconhecida'}]));assert.throws(()=>writeDrafts(memory,[{...draft,priceCents:null}]));writeDrafts(memory,[{...draft,category:'Serviços',priceCents:null}]);assert.equal(readDrafts(memory).length,1)});
test('falha de armazenamento é reportada sem sucesso falso',()=>{assert.throws(()=>writeDrafts({setItem:()=>{throw Error('quota')}},[draft]),/Não foi possível salvar/)});
test('lista local tem limite de cinquenta rascunhos',()=>{assert.throws(()=>writeDrafts(storage(),Array.from({length:51},(_,i)=>({...draft,id:String(i)}))))});
