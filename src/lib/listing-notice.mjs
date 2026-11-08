export function listingNotice(status){
 return ({published:'Anúncio salvo. Ele já aparece para outras pessoas.',pending:'Anúncio salvo. Vamos conferir as informações antes de publicar.',paused:'Alterações salvas. O anúncio continua pausado.',sold:'Alterações salvas. O anúncio continua marcado como vendido.'})[status]||'Alterações salvas. Atualize a lista para conferir o anúncio.';
}
