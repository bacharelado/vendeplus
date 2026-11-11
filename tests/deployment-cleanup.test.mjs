import test from 'node:test';
import assert from 'node:assert/strict';
import {obsoletePreviews,validatedCommit} from '../scripts/cleanup-preview-deployments.mjs';
test('limpeza preserva produção, recuperação, prévias recentes e outras branches',()=>{
 const old={id:'old',environment:'preview',created_on:'2026-11-10T19:00:00Z',latest_stage:{name:'deploy',status:'success'},deployment_trigger:{metadata:{branch:'feat/cloudinary-fotos-free',commit_hash:'a'.repeat(40)}}};
 const candidates=[old,{...old,id:'canonical'}, {...old,id:'prod',environment:'production'}, {...old,id:'recent',created_on:'2026-11-11T03:40:00Z'}, {...old,id:'5165922d-4026-456d-a0e0-0624ec657718'}, {...old,id:'validated',deployment_trigger:{metadata:{branch:'feat/cloudinary-fotos-free',commit_hash:validatedCommit}}}, {...old,id:'other',deployment_trigger:{metadata:{branch:'main'}}}, {...old,id:'active',latest_stage:{name:'deploy',status:'active'}}, {...old,id:'invalid-date',created_on:'unknown'}];
 assert.deepEqual(obsoletePreviews(candidates,'canonical').map(d=>d.id),['old']);
});
