import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';

const accountId='3466eb459952187515061f97996a9a17';
const projectName='vendeplus';
const previewDatabaseName='vendeplus-preview';
const token=process.env.CLOUDFLARE_API_TOKEN?.trim();
const rawPreview=process.env.PREVIEW_URL;

function previewOrigin(value){
  const url=new URL(value);
  const allowed=url.hostname==='vendeplus.pages.dev'||url.hostname.endsWith('.vendeplus.pages.dev');
  if(url.protocol!=='https:'||!allowed||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash){
    throw new Error('A URL deve ser a origem HTTPS da prévia Cloudflare do VENDE+.');
  }
  return url.origin;
}

async function cloudflare(path,method='GET',body){
  let response,data;
  try{
    response=await fetch('https://api.cloudflare.com/client/v4'+path,{
      method,
      redirect:'error',
      signal:AbortSignal.timeout(30000),
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      ...(body===undefined?{}:{body:JSON.stringify(body)})
    });
    data=await response.json();
  }catch{
    throw new Error('Não foi possível consultar a API Cloudflare. Nenhuma credencial foi registrada.');
  }
  if(!response.ok||data?.success!==true){
    const codes=Array.isArray(data?.errors)?data.errors.map(item=>item.code).filter(Number.isInteger).join(', '):'';
    const messages=Array.isArray(data?.errors)?data.errors.map(item=>typeof item.message==='string'?item.message.slice(0,180):'').filter(Boolean).join('; '):'';
    throw new Error('Cloudflare recusou '+method+' '+path.split('?')[0]+': HTTP '+response.status+(codes?'; códigos '+codes:'')+(messages?'; '+messages:''));
  }
  return data.result;
}

async function previewApi(base,path,{method='GET',cookie,body,contentType='application/json'}={}){
  const headers={Origin:base,'Sec-Fetch-Site':'same-origin',Accept:'application/json'};
  if(cookie)headers.Cookie=cookie;
  if(body!==undefined)headers['Content-Type']=contentType;
  const response=await fetch(base+path,{
    method,
    redirect:'manual',
    signal:AbortSignal.timeout(20000),
    headers,
    ...(body===undefined?{}:{body:typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body)})
  });
  const raw=await response.text();
  let data=null;
  try{data=raw?JSON.parse(raw):null}catch{}
  return {response,data,raw};
}

function sessionCookie(response){
  const all=response.headers.getSetCookie?.()||[response.headers.get('set-cookie')||''];
  const header=all.find(value=>value.startsWith('__Host-vendeplus='));
  if(!header)throw new Error('O cadastro não devolveu o cookie de sessão esperado.');
  return header.split(';',1)[0];
}

async function register(base,identity,email){
  const result=await previewApi(base,'/api/account/register',{
    method:'POST',
    body:{
      name:'VENDE+ Auditoria '+identity,
      email,
      password:'Preview-IDOR-2026!'+identity,
      neighborhood:'Poranga II',
      whatsapp:'+55 (92) 00000-000'+(identity==='A'?'1':'2'),
      acceptContact:true
    }
  });
  assert.equal(result.response.status,201,'Cadastro sintético '+identity+' falhou: '+result.raw);
  assert.ok(result.data?.account?.id,'Cadastro não retornou o ID da conta '+identity);
  return {id:result.data.account.id,cookie:sessionCookie(result.response)};
}

async function d1Query(databaseId,sql,params=[]){
  const result=await cloudflare('/accounts/'+accountId+'/d1/database/'+databaseId+'/query','POST',{sql,params});
  if(!Array.isArray(result)||!result.length||result.some(item=>item.success!==true)){
    throw new Error('A consulta D1 não foi confirmada: '+sql.slice(0,100));
  }
  return result[0].results||[];
}

async function cleanup(base,databaseId,accounts){
  for(const account of accounts){
    if(account.cookie){
      try{await previewApi(base,'/api/account/logout',{method:'POST',cookie:account.cookie,body:{}})}catch{}
    }
  }

  const emails=accounts.map(account=>account.email);
  if(!emails.length)return;
  const placeholders=emails.map(()=>'?').join(',');
  const rows=await d1Query(databaseId,
    'SELECT id,email FROM marketplace_accounts WHERE email IN ('+placeholders+')',
    emails
  );

  for(const row of rows){
    const id=String(row.id);
    const email=String(row.email);
    assert.ok(emails.includes(email),'A limpeza encontrou uma conta fora do conjunto de teste.');
    const listingRows=await d1Query(databaseId,'SELECT id FROM marketplace_listings WHERE seller_id=?',[id]);
    const listingIds=listingRows.map(item=>Number(item.id));

    const deletes=[
      ['DELETE FROM marketplace_password_resets WHERE account_id=?',[id]],
      ['DELETE FROM marketplace_sessions WHERE account_id=?',[id]],
      ['DELETE FROM marketplace_seller_reviews WHERE seller_id=?',[id]],
      ['DELETE FROM marketplace_moderation_log WHERE listing_id IN (SELECT id FROM marketplace_listings WHERE seller_id=?)',[id]],
      ['DELETE FROM marketplace_listing_events WHERE seller_id=?',[id]],
      ['DELETE FROM marketplace_listing_details WHERE seller_id=?',[id]],
      ['DELETE FROM marketplace_reports WHERE listing_id IN (SELECT id FROM marketplace_listings WHERE seller_id=?)',[id]],
      ['DELETE FROM marketplace_listings WHERE seller_id=?',[id]],
      ['DELETE FROM marketplace_seller_profiles WHERE seller_id=?',[id]],
      ['DELETE FROM marketplace_accounts WHERE id=?',[id]],
      ['DELETE FROM marketplace_sellers WHERE id=?',[id]]
    ];
    for(const [sql,params] of deletes)await d1Query(databaseId,sql,params);

    const keys=[
      createHash('sha256').update('auth-email:'+email).digest('hex'),
      createHash('sha256').update('listing:'+id).digest('hex')
    ];
    await d1Query(databaseId,'DELETE FROM marketplace_rate_limits WHERE key IN (?,?)',keys);
    console.log('Conta sintética removida e dados relacionados limpos:',email,'; anúncios:',listingIds.length);
  }

  const remaining=await d1Query(databaseId,
    'SELECT COUNT(*) AS total FROM marketplace_accounts WHERE email IN ('+placeholders+')',
    emails
  );
  assert.equal(Number(remaining[0]?.total||0),0,'A limpeza deixou contas sintéticas no banco de prévia.');
}

async function main(){
  if(!rawPreview)throw new Error('PREVIEW_URL não foi informado.');
  if(!token)throw new Error('CLOUDFLARE_API_TOKEN não está configurado nos segredos do GitHub. Nenhuma conta foi criada.');
  const base=previewOrigin(rawPreview);
  const project=await cloudflare('/accounts/'+accountId+'/pages/projects/'+projectName);
  if(project?.name!==projectName||!project.deployment_configs?.preview){
    throw new Error('Não foi possível confirmar a configuração do projeto Cloudflare Pages.');
  }
  const previewDatabaseId=project.deployment_configs.preview.d1_databases?.MARKETPLACE_DB?.id;
  if(!previewDatabaseId)throw new Error('A prévia não possui o binding D1 MARKETPLACE_DB. Nenhuma conta foi criada.');
  const productionIds=Object.values(project.deployment_configs.production?.d1_databases||{}).map(binding=>binding?.id).filter(Boolean);
  if(productionIds.includes(previewDatabaseId)){
    throw new Error('Bloqueio de segurança: o banco vinculado à prévia também está vinculado à produção.');
  }
  const databases=await cloudflare('/accounts/'+accountId+'/d1/database?name='+encodeURIComponent(previewDatabaseName)+'&per_page=100&page=1');
  const database=databases.find(item=>item.uuid===previewDatabaseId);
  if(!database||database.name!==previewDatabaseName){
    throw new Error('O D1 da prévia não corresponde ao banco isolado esperado ('+previewDatabaseName+'). Nenhuma conta foi criada.');
  }

  const readiness=await previewApi(base,'/api/media-upload?check=preview');
  assert.equal(readiness.response.status,200,'A verificação do banco na prévia falhou.');
  assert.equal(readiness.data?.checks?.database,true,'A API da prévia não confirmou o banco de dados.');
  const anonymous=await previewApi(base,'/api/account/session');
  assert.equal(anonymous.response.status,200,'A sessão anônima não respondeu corretamente.');
  assert.equal(anonymous.data?.account,null,'A prévia não começou sem autenticação.');

  const runTag=Date.now().toString(36)+'-'+randomUUID().slice(0,8);
  const accounts=[
    {identity:'A',email:'vendeplus.idor.a.'+runTag+'@example.invalid',cookie:null},
    {identity:'B',email:'vendeplus.idor.b.'+runTag+'@example.invalid',cookie:null}
  ];
  let failure;

  try{
    console.log('Banco de prévia isolado confirmado. Iniciando teste com duas contas sintéticas.');
    const a=await register(base,'A',accounts[0].email);
    accounts[0]={...accounts[0],...a};
    const b=await register(base,'B',accounts[1].email);
    accounts[1]={...accounts[1],...b};

    const original={
      title:'Anúncio temporário IDOR '+runTag,
      description:'Produto sintético para verificar isolamento entre vendedores.',
      priceCents:12500,
      category:'Casa',
      condition:'Usado',
      fulfillment:'Retirada a combinar',
      neighborhood:'Poranga II',
      requestId:randomUUID()
    };

    const created=await previewApi(base,'/api/account/listings',{
      method:'POST',cookie:a.cookie,body:original
    });
    assert.equal(created.response.status,201,'A conta A não conseguiu criar o anúncio: '+created.raw);
    const listingId=Number(created.data?.id);
    assert.ok(Number.isSafeInteger(listingId)&&listingId>0,'O anúncio de teste não retornou um ID válido.');
    console.log('Conta A criou o anúncio sintético:',listingId);

    const bOwnListings=await previewApi(base,'/api/account/listings',{cookie:b.cookie});
    assert.equal(bOwnListings.response.status,200);
    assert.deepEqual(bOwnListings.data?.listings,[],'A conta B recebeu anúncios privados da conta A.');

    const bPrivateRead=await previewApi(base,'/api/account/listings/'+listingId,{cookie:b.cookie});
    assert.equal(bPrivateRead.response.status,404,'A conta B conseguiu ler a rota privada do anúncio A.');

    const editPayload={...original,action:'edit',title:'IDOR-B-NAO-DEVE-APARECER'};
    const bEdit=await previewApi(base,'/api/account/listings/'+listingId,{
      method:'PATCH',cookie:b.cookie,body:editPayload
    });
    assert.equal(bEdit.response.status,404,'A conta B conseguiu alterar o anúncio da conta A: '+bEdit.raw);

    const bRemove=await previewApi(base,'/api/account/listings/'+listingId,{
      method:'PATCH',cookie:b.cookie,body:{status:'removed'}
    });
    assert.equal(bRemove.response.status,404,'A conta B conseguiu remover o anúncio da conta A: '+bRemove.raw);

    if(readiness.data?.available===true){
      const pngSignature=new Uint8Array([137,80,78,71,13,10,26,10]);
      const bUpload=await previewApi(base,'/api/media-upload?listingId='+listingId,{
        method:'POST',cookie:b.cookie,body:pngSignature,contentType:'image/png'
      });
      assert.equal(bUpload.response.status,404,'A conta B conseguiu iniciar upload para anúncio da conta A: '+bUpload.raw);
      console.log('Upload cruzado também foi bloqueado.');
    }else{
      console.log('Upload cruzado não testado: armazenamento de imagens indisponível na prévia.');
    }

    const afterAttack=await previewApi(base,'/api/account/listings',{cookie:a.cookie});
    assert.equal(afterAttack.response.status,200);
    const preserved=afterAttack.data?.listings?.find(item=>Number(item.id)===listingId);
    assert.ok(preserved,'O anúncio A desapareceu após tentativas da conta B.');
    assert.equal(preserved.title,original.title,'A conta B alterou o título do anúncio A.');
    assert.equal(preserved.status,created.data.status,'A conta B alterou o status do anúncio A.');

    const ownerEdit=await previewApi(base,'/api/account/listings/'+listingId,{
      method:'PATCH',cookie:a.cookie,body:{...original,action:'edit',title:'Anúncio IDOR atualizado pela conta A'}
    });
    assert.equal(ownerEdit.response.status,200,'A conta proprietária não conseguiu editar seu próprio anúncio: '+ownerEdit.raw);

    const bAfter=await previewApi(base,'/api/account/listings',{cookie:b.cookie});
    assert.deepEqual(bAfter.data?.listings,[],'O anúncio A apareceu na área privada da conta B após a edição.');
    console.log('IDOR A/B aprovado: leitura privada, edição e remoção cruzadas bloqueadas; edição do proprietário permitida.');
  }catch(error){
    failure=error;
  }

  try{
    await cleanup(base,previewDatabaseId,accounts);
  }catch(error){
    failure=failure?new AggregateError([failure,error],'O teste falhou e a limpeza automática também encontrou um erro.'):error;
  }

  if(failure)throw failure;
  console.log('Limpeza concluída: contas sintéticas, sessões, anúncios e limites de teste removidos do D1 da prévia.');
}

main().catch(error=>{
  console.error(error instanceof Error?error.message:'Falha desconhecida no teste IDOR real.');
  process.exitCode=1;
});
