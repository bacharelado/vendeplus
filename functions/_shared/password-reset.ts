import {SUPPORT_WHATSAPP_URL} from '../../src/lib/support.mjs';

// Retained URLs direct visitors to support; they cannot issue or consume reset tokens.
export function handlePasswordReset({request,path}:{request:Request;path:string}):Response {
 const status=path==='/password-reset/status'&&request.method==='GET';
 return Response.json(status
  ? {available:false,method:'whatsapp',supportUrl:SUPPORT_WHATSAPP_URL}
  : {error:'Para recuperar o acesso, fale com o suporte no WhatsApp.',supportUrl:SUPPORT_WHATSAPP_URL},
  {status:status?200:410,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
