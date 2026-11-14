import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readJson,RequestFailure} from '../functions/_shared/http.ts';

const origin='https://vendeplus.test';
const headers={Origin:origin,'Content-Type':'application/json'};
const request=(body,extra={})=>new Request(origin+'/api/reports',{method:'POST',headers:{...headers,...extra},body});

test('JSON requests require the same origin and reject cross-site fetches',async()=>{
  for(const extra of [{Origin:'https://evil.test'},{Origin:''},{'Sec-Fetch-Site':'cross-site'}]){
    await assert.rejects(()=>readJson(request('{}',extra)),error=>error instanceof RequestFailure&&error.status===403);
  }
});

test('invalid JSON, non-object values and invalid UTF-8 are client errors',async()=>{
  for(const body of ['{','null','[]','42','"spam"',new Uint8Array([0xff,0xfe])]){
    await assert.rejects(()=>readJson(request(body)),error=>error.status===400);
  }
  await assert.rejects(()=>readJson(request('{}',{'Content-Type':'text/plain'})),error=>error.status===415);
  assert.deepEqual(await readJson(request('{"details":"á😀"}')), {details:'á😀'});
});

test('streamed bodies stop at the byte limit without trusting Content-Length',async()=>{
  let cancelled=false,pulls=0;
  const stream=new ReadableStream({pull(controller){pulls++;controller.enqueue(new Uint8Array(1024))},cancel(){cancelled=true}});
  const incoming=new Request(origin+'/api/reports',{method:'POST',headers,body:stream,duplex:'half'});
  await assert.rejects(()=>readJson(incoming,2048),error=>error.status===413);
  assert.equal(cancelled,true);
  assert.ok(pulls<=4,'the reader must not consume the rest of an oversized body');
  await assert.rejects(()=>readJson(request('{}',{'Content-Length':'999999999'}),2048),error=>error.status===413);
});
