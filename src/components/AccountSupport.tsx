import {useEffect} from 'react';
import {Icon} from './Icon';
import {ROUTES} from '../lib/routes.mjs';
import {SUPPORT_WHATSAPP_URL} from '../lib/support.mjs';

export function AccountSupport() {
  useEffect(()=>{
    if(location.hash.startsWith('#entrar?redefinir='))history.replaceState(null,'',location.pathname+location.search+ROUTES.recovery);
  });
  return <section className="account-area">
    <a className="back" href={ROUTES.login}>← Voltar à entrada</a>
    <div className="page-heading"><h1>Precisa de ajuda para entrar?</h1><p>Fale com o suporte do VENDE+ pelo WhatsApp para solicitar a recuperação do acesso.</p></div>
    <div className="panel">
      <a className="button primary" href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp"/>Falar com o suporte no WhatsApp</a>
      <p className="field-help">O atendimento precisa confirmar que a conta é sua. Não envie senhas nem códigos de acesso.</p>
    </div>
  </section>;
}
