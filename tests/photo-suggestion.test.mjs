import test from 'node:test';
import assert from 'node:assert/strict';
import {photoSuggestion} from '../functions/_shared/photo-suggestion.ts';
import {onRequest} from '../functions/api/photo-analyze.ts';
const result=JSON.stringify({title:'Cadeira de madeira',category:'Casa',description:'Uma cadeira com encosto de madeira fotografada de frente.',priceCents:1,condition:'Novo'});
test('IA gera somente título descrição categoria; não escolhe preço ou condição',()=>{
 const suggestion=photoSuggestion({response:result});
 assert.deepEqual(suggestion,{title:'Cadeira de madeira',description:'Uma cadeira com encosto de madeira fotografada de frente.',category:'Casa',needsReview:true,priceCents:null});
});
test('não aceita JSON quebrado, categoria inexistente ou resultado incerto',()=>{
 assert.equal(photoSuggestion('instruções sem JSON'),null);
 assert.equal(photoSuggestion('{"uncertain":true}'),null);
 assert.equal(photoSuggestion('{"title":"Cadeira de madeira","category":"Outros","description":"Uma cadeira visível na foto."}'),null);
});
test('IA fica desativada mesmo com serviço configurado',async()=>{
 let called=false;
 const response=await onRequest({request:new Request('https://preview.vendeplus.pages.dev/api/photo-analyze',{method:'POST',body:'foto'}),env:{AI:{run(){called=true}}}});
 assert.equal(response.status,503);assert.match((await response.json()).error,/desativado/);assert.equal(called,false);
});
