import assert from 'node:assert/strict';
import {test} from 'node:test';
import {handleAccount} from '../functions/_shared/account.ts';
import {onRequest as uploadPhoto} from '../functions/api/media-upload.ts';
import {database} from './helpers/database.mjs';

const origin='https://vendeplus.test';
const accountEnv=db=>({MARKETPLACE_DB:db});
const headers=(cookie,extra={})=>({
  Origin:origin,
  'Sec-Fetch-Site':'same-origin',
  ...(cookie?{Cookie:cookie}:{}),
  ...extra
});

async function accountRequest(db,path,{method='GET',cookie,data}={}){
  const request=new Request(origin+'/api/account'+path,{
    method,
    headers:headers(cookie,data===undefined?{}:{'Content-Type':'application/json'}),
    ...(data===undefined?{}:{body:JSON.stringify(data)})
  });
  return handleAccount({request,env:accountEnv(db)});
}

async function register(db,identity){
  const response=await accountRequest(db,'/register',{
    method:'POST',
    data:{
      name:'Conta de teste '+identity,
      email:'vendeplus.idor.'+identity.toLowerCase()+'.20261112@example.invalid',
      password:'TestOnly-'+identity+'-2026!',
      neighborhood:'Poranga I',
      whatsapp:identity==='A'?'(92) 99999-9991':'(92) 99999-9992',
      acceptContact:true
    }
  });
  assert.equal(response.status,201,await response.text());
  const cookie=response.headers.get('set-cookie')?.split(';',1)[0];
  assert.ok(cookie,'registro deve emitir cookie de sessão');
  return cookie;
}

test('IDOR: outra conta não lista, edita, remove nem envia foto para anúncio alheio',async()=>{
  const {db,sqlite}=database();
  try{
    const cookieA=await register(db,'A');
    const cookieB=await register(db,'B');

    const created=await accountRequest(db,'/listings',{
      method:'POST',
      cookie:cookieA,
      data:{
        title:'Mesa de teste IDOR',
        description:'Anúncio privado para validar o isolamento entre contas.',
        priceCents:12500,
        category:'Casa',
        condition:'Usado',
        fulfillment:'Retirada a combinar',
        neighborhood:'Poranga I',
        requestId:'20261112-idor-test-account-a'
      }
    });
    assert.equal(created.status,201,await created.text());
    const listingId=(await created.json()).id;

    const bListings=await accountRequest(db,'/listings',{cookie:cookieB});
    assert.equal(bListings.status,200);
    assert.deepEqual((await bListings.json()).listings,[]);

    const editByB=await accountRequest(db,'/listings/'+listingId,{
      method:'PATCH',
      cookie:cookieB,
      data:{action:'edit',title:'IDOR-B-NAO-DEVE-APARECER'}
    });
    assert.equal(editByB.status,404);

    const removeByB=await accountRequest(db,'/listings/'+listingId,{
      method:'PATCH',
      cookie:cookieB,
      data:{status:'removed'}
    });
    assert.equal(removeByB.status,404);

    const uploadRequest=new Request(origin+'/api/media-upload?listingId='+listingId,{
      method:'POST',
      headers:headers(cookieB,{'Content-Type':'image/png'}),
      body:new Uint8Array([1,2,3,4])
    });
    const uploadResponse=await uploadPhoto({
      request:uploadRequest,
      env:{MARKETPLACE_DB:db,LISTING_IMAGES:{put:async()=>{},delete:async()=>{}}}
    });
    assert.equal(uploadResponse.status,404);

    const unchanged=sqlite.prepare('SELECT title,status,image_url,seller_id FROM marketplace_listings WHERE id=?').get(listingId);
    assert.equal(unchanged.title,'Mesa de teste IDOR');
    assert.equal(unchanged.image_url,null);
    assert.equal(unchanged.seller_id,(await (await accountRequest(db,'/session',{cookie:cookieA})).json()).account.id);

    const ownerEdit=await accountRequest(db,'/listings/'+listingId,{
      method:'PATCH',
      cookie:cookieA,
      data:{
        action:'edit',
        title:'Mesa de teste IDOR atualizada',
        description:'Alteração permitida somente pela conta proprietária.',
        priceCents:13000,
        category:'Casa',
        condition:'Usado',
        fulfillment:'Retirada a combinar',
        neighborhood:'Poranga I'
      }
    });
    assert.equal(ownerEdit.status,200,await ownerEdit.text());

    const final=sqlite.prepare('SELECT title FROM marketplace_listings WHERE id=?').get(listingId);
    assert.equal(final.title,'Mesa de teste IDOR atualizada');
    assert.deepEqual((await (await accountRequest(db,'/listings',{cookie:cookieB})).json()).listings,[]);
  }finally{
    sqlite.close();
  }
});
