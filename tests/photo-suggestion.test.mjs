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
test('não chama IA sem credenciais, origem segura e JPEG válido',async()=>{
 let called=false;
 const env={MARKETPLACE_DB:{prepare:()=>({bind:()=>({first:async()=>null})})},AI:{run:async()=>{called=true;return {response:result}}}};
 const post=(headers,body)=>onRequest({request:new Request('https://preview.vendeplus.pages.dev/api/photo-analyze',{method:'POST',headers,body}),env});
 const invalid=await post({Origin:'https://preview.vendeplus.pages.dev','Content-Type':'text/plain'},'invalid');
 assert.equal(invalid.status,415);
 const unauthenticated=await post({Origin:'https://preview.vendeplus.pages.dev','Content-Type':'image/jpeg'},new Uint8Array(120).fill(255));
 assert.equal(unauthenticated.status,401);
 const csrf=await post({Origin:'https://attacker.test','Content-Type':'image/jpeg'},new Uint8Array(120).fill(255));
 assert.equal(csrf.status,403);
 assert.equal(called,false);
});
