/** Converte preços BRL digitados para centavos, sem ponto flutuante na representação final. */
export function parseBRL(raw, isService = false) {
  const text = String(raw ?? '').trim();
  if (!text) return isService ? {ok:true, cents:null} : {ok:false, error:'Informe o preço.'};
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)) {
    return {ok:false,error:'Use um preço válido, como 25,90 ou 1.250,00.'};
  }
  const [whole, decimal = ''] = text.replaceAll('.','').split(',');
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2,'0'));
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 100000000) {
    return {ok:false,error:'O preço deve ser maior que zero e até R$ 1.000.000,00.'};
  }
  return {ok:true,cents};
}

export function formatBRL(cents) {
  return cents === null ? 'Sob orçamento' : (cents / 100).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
}

export function classifyContent(text) {
  const normalized = String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if (/\b(arma|armas|vape|cigarro|cigarros|maconha)\b/.test(normalized)) return 'BLOQUEADO';
  if (/pagamento antecipado|pagamento adiantado|pix antes/.test(normalized)) return 'EM_ANALISE';
  return 'PUBLICADO';
}
