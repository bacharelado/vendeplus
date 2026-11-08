export function normalizeWhatsapp(value){
  if(typeof value!=='string')return null;
  const input=value.trim();
  if(!input||input.length>32||!/^\+?[0-9 ()-]+$/.test(input))return null;
  const digits=input.replace(/[^0-9]/g,'');
  if(/^55[0-9]{10,11}$/.test(digits))return digits;
  if(!input.startsWith('+')&&/^[0-9]{10,11}$/.test(digits))return '55'+digits;
  return null;
}
