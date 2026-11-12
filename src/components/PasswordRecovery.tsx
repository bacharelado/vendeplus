import {useEffect,useState,type FormEvent} from 'react';
import {Button,Field} from './UI';
async function api(path:string,body?:unknown){
 const r=await fetch('/api/account/password-reset/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 let value;try{value=await r.json()}catch{throw Error('Não foi possível acessar o serviço. Tente novamente.')}
 if(!r.ok)throw Error(typeof value.error==='string'?value.error:'Não foi possível concluir a solicitação.');
 return value;
}
export function PasswordRecovery({token}:{token?:string}){
 const [available,setAvailable]=useState<boolean>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[done,setDone]=useState(false);
 const validToken=token!==undefined&&/^[a-f0-9]{64}$/.test(token);
 useEffect(()=>{
  if(token!==undefined){history.replaceState(null,'',location.pathname+location.search+'#entrar?recuperar');return}
  let active=true;api('status').then(value=>{if(active)setAvailable(value.available===true)}).catch(()=>{if(active){setAvailable(false);setError('Não foi possível consultar o envio de e-mails. Tente novamente mais tarde.')}});
  return ()=>{active=false};
 },[token]);
 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();setError('');setNotice('');
  const form=event.currentTarget,data=new FormData(form),password=String(data.get('password')||'');
  if(token!==undefined&&password!==data.get('confirm')){setError('As duas senhas precisam ser iguais.');return}
  setBusy(true);
  try{
   const result=await api(token===undefined?'request':'confirm',token===undefined?{email:String(data.get('email')||'')}:{token,password});
   form.reset();setNotice(result.message);if(token!==undefined)setDone(true);
  }catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível concluir a solicitação.')}
  finally{setBusy(false)}
 };
 return <section className="account-area"><a className="back" href="#entrar">← Voltar à entrada</a><div className="page-heading"><h1>{token===undefined?'Recuperar senha.':'Criar nova senha.'}</h1><p>{token===undefined?'Receba um link no e-mail usado no cadastro.':'Escolha uma nova senha para sua conta. O link vale por 15 minutos e só funciona uma vez.'}</p></div>
  {error&&<p className="form-error" role="alert">{error}</p>}
  {notice&&<p className="account-notice" role="status">{notice}</p>}
  {token===undefined?available===undefined?<p className="catalog-loading" role="status">Consultando recuperação por e-mail…</p>:available?<form className="draft-form panel account-form" onSubmit={submit}><Field label="E-mail cadastrado"><input type="email" name="email" required maxLength={254} autoComplete="email"/></Field><Button type="submit" full disabled={busy}>{busy?'Solicitando…':'Enviar link de recuperação'}</Button><p className="field-help">Se houver uma conta ativa, enviaremos as instruções. Confira também o spam.</p></form>:<div className="panel"><h2>Envio de e-mails ainda indisponível</h2><p>A recuperação de senha está preparada, mas ainda não pode enviar links. Não é possível redefinir a senha por esta tela no momento.</p><a className="button outline" href="#entrar">Voltar à entrada</a></div>
  :!validToken?<div className="panel"><p>Este link não é válido.</p><a className="button primary" href="#entrar?recuperar">Solicitar outro link</a></div>
  :done?<a className="button primary" href="#entrar">Entrar com a nova senha</a>:<form className="draft-form panel account-form" onSubmit={submit}><Field label="Nova senha" hint="Use de 8 a 128 caracteres."><input type="password" name="password" required minLength={8} maxLength={128} autoComplete="new-password"/></Field><Field label="Repita a nova senha"><input type="password" name="confirm" required minLength={8} maxLength={128} autoComplete="new-password"/></Field><Button type="submit" full disabled={busy}>{busy?'Alterando…':'Salvar nova senha'}</Button><a className="text-link" href="#entrar?recuperar">Solicitar outro link</a></form>}
 </section>;
}
