import test from 'node:test';
import assert from 'node:assert/strict';
import {listingNotice} from '../src/lib/listing-notice.mjs';
test('aviso respeita anúncios pausados, vendidos e em conferência',()=>{
 assert.match(listingNotice('paused'),/continua pausado/);
 assert.match(listingNotice('sold'),/continua marcado como vendido/);
 assert.match(listingNotice('pending'),/antes de publicar/);
 assert.match(listingNotice('published'),/já aparece/);
 assert.doesNotMatch(listingNotice(undefined),/já aparece/);
});
