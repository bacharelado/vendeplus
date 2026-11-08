import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWhatsapp} from '../src/lib/phone.mjs';
test('aceita prefixo +55 e formatação usual sem alterar os dígitos do número',()=>{
 for(const input of ['5592000000000','+5592000000000','+55 (92) 00000-0000','55 92 00000 0000','92000000000','(92) 00000-0000','  +55 (92) 00000-0000  '])assert.equal(normalizeWhatsapp(input),'5592000000000');
 for(const input of ['559200000000','+55 (92) 0000-0000','9200000000'])assert.equal(normalizeWhatsapp(input),'559200000000');
});
test('rejeita número incompleto, país estrangeiro, texto e prefixo malformado',()=>{
 for(const input of [null,undefined,123,'','   ','00000-0000','+56 92 00000-0000','++5592000000000','55+92000000000','55abc92000000000','(92) 00000-0000 ramal 1','9'.repeat(40),'+92000000000'])assert.equal(normalizeWhatsapp(input),null);
});
